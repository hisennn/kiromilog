import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getSession, requireVerifiedSession } from "@/lib/auth/server";
import { db, sql } from "@/lib/db";
import { users } from "@/lib/db/schema";

type ViewerProfileSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
};

function normalizeUsername(input: string) {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .toLowerCase()
    .replace(/[.-]{2,}/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 30);

  if (normalized.length >= 3) {
    return normalized;
  }

  return `user_${normalized.padEnd(3, "x")}`.slice(0, 30);
}

async function findAvailableUsername(base: string) {
  const seed = normalizeUsername(base);

  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? "" : `_${index + 1}`;
    const candidate = `${seed.slice(0, 30 - suffix.length)}${suffix}`;
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);

    if (!existing[0]) {
      return candidate;
    }
  }

  return `user_${Date.now().toString().slice(-8)}`;
}

function isRedirectError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.message.startsWith("REDIRECT:")) {
    return true;
  }

  const digest = (error as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.includes("NEXT_REDIRECT") || digest.includes("REDIRECT"))
  );
}

function isEmailUniqueViolation(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message.includes("users_email_unique") ||
      error.message.includes("duplicate key")
    ) {
      return true;
    }

    const code = (error as { code?: unknown }).code;
    if (code === "23505") {
      return true;
    }

    const cause = (error as { cause?: unknown }).cause;
    if (cause instanceof Error) {
      return isEmailUniqueViolation(cause);
    }

    if (
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      (cause as { code?: unknown }).code === "23505"
    ) {
      return true;
    }
  }

  return false;
}

async function syncViewerProfile(session: ViewerProfileSession) {
  const normalizedEmail = session.user.email.trim().toLowerCase();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (existing[0]) {
    if (existing[0].email === normalizedEmail) {
      return existing[0];
    }

    try {
      const colliding = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (colliding[0] && colliding[0].id !== session.user.id) {
        console.warn(
          "[viewer-profile] Email already used by another profile; keeping existing email.",
          { userId: session.user.id },
        );
        return existing[0];
      }
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }

      console.error(
        "[viewer-profile] Email collision lookup failed; keeping existing email.",
        { userId: session.user.id },
      );
      return existing[0];
    }

    try {
      const [updated] = await db
        .update(users)
        .set({
          email: normalizedEmail,
          updatedAt: new Date(),
        })
        .where(eq(users.id, session.user.id))
        .returning();

      return updated ?? existing[0];
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }

      if (isEmailUniqueViolation(error)) {
        console.warn(
          "[viewer-profile] Concurrent email update conflict; keeping existing email.",
          { userId: session.user.id },
        );

        try {
          const reread = await db
            .select()
            .from(users)
            .where(eq(users.id, session.user.id))
            .limit(1);

          if (reread[0]) {
            return reread[0];
          }
        } catch (rereadError) {
          if (isRedirectError(rereadError)) {
            throw rereadError;
          }

          console.error(
            "[viewer-profile] Profile re-read after email conflict failed.",
            { userId: session.user.id },
          );
        }

        return existing[0];
      }

      throw error;
    }
  }

  const freshSession = await getSession({ disableCookieCache: true });

  if (freshSession?.user?.id !== session.user.id || !freshSession.user.emailVerified) {
    redirect("/auth/sign-in");
  }

  let conflicting: typeof existing | undefined;

  try {
    conflicting = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
  } catch (lookupError) {
    if (isRedirectError(lookupError)) {
      throw lookupError;
    }

    console.error(
      "[viewer-profile] Email lookup failed before insert; attempting insert anyway.",
      { userId: session.user.id },
    );
    conflicting = undefined;
  }

  if (conflicting?.[0] && conflicting[0].id !== session.user.id) {
    const orphanId = conflicting[0].id;
    let activeIdentityExists = true;

    try {
      const identities = await sql.query(
        'SELECT id FROM neon_auth."user" WHERE id = $1::uuid',
        [orphanId],
      );
      activeIdentityExists = identities.length > 0;
    } catch (checkError) {
      if (isRedirectError(checkError)) {
        throw checkError;
      }

      console.error(
        "[viewer-profile] Auth identity check failed; treating email conflict as genuine.",
        { userId: session.user.id },
      );
      activeIdentityExists = true;
    }

    if (activeIdentityExists) {
      console.error(
        "[viewer-profile] Email belongs to another active account; redirecting to sign-in.",
        { userId: session.user.id },
      );
      redirect("/auth/sign-in");
    }

    console.warn(
      "[viewer-profile] Reclaiming orphaned profile email from deleted identity.",
      { orphanId, userId: session.user.id },
    );
    await db.delete(users).where(eq(users.id, orphanId));
  }

  const nameSeed =
    session.user.name?.trim() ||
    normalizedEmail.split("@")[0] ||
    session.user.id;
  const username = await findAvailableUsername(nameSeed);
  const nickname = username;

  try {
    const [created] = await db
      .insert(users)
      .values({
        id: session.user.id,
        email: normalizedEmail,
        username,
        nickname,
        avatarUrl: session.user.image ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: normalizedEmail,
          updatedAt: new Date(),
        },
      })
      .returning();

    return created;
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (isEmailUniqueViolation(error)) {
      console.warn(
        "[viewer-profile] Email conflict on insert; resolving without 500.",
        { userId: session.user.id },
      );

      try {
        const byId = await db
          .select()
          .from(users)
          .where(eq(users.id, session.user.id))
          .limit(1);

        if (byId[0]) {
          return byId[0];
        }

        const byEmail = await db
          .select()
          .from(users)
          .where(eq(users.email, normalizedEmail))
          .limit(1);

        if (byEmail[0]) {
          if (byEmail[0].id !== session.user.id) {
            console.error(
              "[viewer-profile] Email still owned by another profile after conflict; redirecting.",
              { userId: session.user.id },
            );
            redirect("/auth/sign-in");
          }

          return byEmail[0];
        }
      } catch (rereadError) {
        if (isRedirectError(rereadError)) {
          throw rereadError;
        }

        console.error(
          "[viewer-profile] Profile re-read after insert conflict failed.",
          { userId: session.user.id },
        );
      }

      redirect("/auth/sign-in");
    }

    throw error;
  }
}

export async function getViewerProfile() {
  const session = await getSession();

  if (!session?.user || !session.user.emailVerified) {
    return null;
  }

  return syncViewerProfile({
    user: {
      id: session.user.id,
      email: session.user.email.trim().toLowerCase(),
      name: session.user.name,
      image: session.user.image,
    },
  });
}

export async function ensureViewerProfile(options?: { allowCookieMutation?: boolean }) {
  const session = await requireVerifiedSession(options);

  return syncViewerProfile({
    user: {
      id: session.user.id,
      email: session.user.email.trim().toLowerCase(),
      name: session.user.name,
      image: session.user.image,
    },
  });
}
