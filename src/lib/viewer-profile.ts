import "server-only";

import { eq } from "drizzle-orm";

import { getSession, requireVerifiedSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
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

async function syncViewerProfile(session: ViewerProfileSession) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(users)
      .set({
        email: session.user.email,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))
      .returning();

    return updated;
  }

  const nameSeed =
    session.user.name?.trim() ||
    session.user.email.split("@")[0] ||
    session.user.id;
  const username = await findAvailableUsername(nameSeed);
  const nickname = username;

  const [created] = await db
    .insert(users)
    .values({
      id: session.user.id,
      email: session.user.email,
      username,
      nickname,
      avatarUrl: session.user.image ?? null,
      onboardingCompleted: false,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        email: session.user.email,
        updatedAt: new Date(),
      },
    })
    .returning();

  return created;
}

export async function getViewerProfile() {
  const session = await getSession();

  if (!session?.user || !session.user.emailVerified) {
    return null;
  }

  return syncViewerProfile({
    user: {
      id: session.user.id,
      email: session.user.email,
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
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    },
  });
}
