import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";

export const auth = createNeonAuth({
  baseUrl: env.NEON_AUTH_BASE_URL,
  cookies: {
    secret: env.NEON_AUTH_COOKIE_SECRET,
    sessionDataTtl: 300,
  },
});

export async function getSession(options?: { disableCookieCache?: boolean }) {
  const { data } = await auth.getSession(
    options?.disableCookieCache
      ? {
          query: {
            disableCookieCache: true,
          },
        }
      : undefined,
  );

  return data;
}

export async function requireSession() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  return session;
}

export async function requireVerifiedSession() {
  const session = await requireSession();

  if (!session.user.emailVerified) {
    const freshSession = await getSession({ disableCookieCache: true });

    if (freshSession?.user?.emailVerified) {
      return freshSession;
    }
  }

  if (!session.user.emailVerified) {
    redirect("/auth/verify-email");
  }

  return session;
}
