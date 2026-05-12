import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";
import { jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";

export const auth = createNeonAuth({
  baseUrl: env.NEON_AUTH_BASE_URL,
  cookies: {
    secret: env.NEON_AUTH_COOKIE_SECRET,
    sessionDataTtl: 300,
  },
});

type SessionResult = Awaited<ReturnType<typeof auth.getSession>>["data"];
type MaybeSessionResponse = SessionResult | { data?: SessionResult } | null;

const NEON_AUTH_COOKIE_PREFIX = "__Secure-neon-auth";
const NEON_AUTH_SESSION_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.session_token`;
const NEON_AUTH_SESSION_DATA_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.local.session_data`;

const emptySession = { session: null, user: null } as SessionResult;

function normalizeSessionResponse(
  response: MaybeSessionResponse,
  fallback: SessionResult,
) {
  if (response && "user" in response) {
    return response;
  }

  if (
    response &&
    "data" in response &&
    response.data &&
    "user" in response.data
  ) {
    return response.data;
  }

  return fallback;
}

function getRequestOrigin(headerStore: Headers) {
  return (
    headerStore.get("origin") ||
    headerStore.get("referer")?.split("/").slice(0, 3).join("/") ||
    env.NEXT_PUBLIC_APP_URL
  );
}

function parseDate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date;
}

function normalizeSessionDates(response: SessionResult) {
  if (!response?.session || !response.user) {
    return response;
  }

  return {
    session: {
      ...response.session,
      createdAt: parseDate(response.session.createdAt),
      updatedAt: parseDate(response.session.updatedAt),
      expiresAt: parseDate(response.session.expiresAt),
    },
    user: {
      ...response.user,
      createdAt: parseDate(response.user.createdAt),
      updatedAt: parseDate(response.user.updatedAt),
    },
  } as SessionResult;
}

async function getCachedSessionFromCookie() {
  const cookieStore = await cookies();
  const hasSessionToken = Boolean(cookieStore.get(NEON_AUTH_SESSION_COOKIE_NAME)?.value);
  const sessionDataCookie = cookieStore.get(NEON_AUTH_SESSION_DATA_COOKIE_NAME)?.value;

  if (!hasSessionToken || !sessionDataCookie) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(
      sessionDataCookie,
      new TextEncoder().encode(env.NEON_AUTH_COOKIE_SECRET),
      { algorithms: ["HS256"] },
    );

    return normalizeSessionDates(payload as SessionResult);
  } catch {
    return null;
  }
}

async function fetchSessionReadOnly(fallback: SessionResult) {
  const headerStore = await headers();
  const url = new URL(`${env.NEON_AUTH_BASE_URL}/get-session`);

  try {
    const response = await fetch(url, {
      headers: {
        Cookie: headerStore.get("cookie") ?? "",
        Origin: getRequestOrigin(headerStore),
        "x-neon-auth-proxy": "nextjs",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return fallback;
    }

    return normalizeSessionResponse(
      (await response.json()) as MaybeSessionResponse,
      fallback,
    );
  } catch {
    return fallback;
  }
}

export async function getSession(
  options?: { disableCookieCache?: boolean },
): Promise<SessionResult> {
  const cookieStore = await cookies();

  if (!cookieStore.get(NEON_AUTH_SESSION_COOKIE_NAME)?.value) {
    return emptySession;
  }

  if (options?.disableCookieCache !== true) {
    const cachedSession = await getCachedSessionFromCookie();

    if (cachedSession?.user) {
      return cachedSession;
    }
  }

  return fetchSessionReadOnly(emptySession);
}

export async function getSessionWithCookieMutation(
  options?: { disableCookieCache?: boolean },
): Promise<SessionResult> {
  const { data } = await auth.getSession(
    options?.disableCookieCache
      ? { query: { disableCookieCache: "true" } }
      : undefined,
  );

  return data;
}

export async function requireSession(options?: { allowCookieMutation?: boolean }) {
  const session = options?.allowCookieMutation
    ? await getSessionWithCookieMutation()
    : await getSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  return session;
}

export async function requireVerifiedSession(options?: { allowCookieMutation?: boolean }) {
  const session = await requireSession(options);

  if (!session.user.emailVerified) {
    const freshSession = options?.allowCookieMutation
      ? await getSessionWithCookieMutation({ disableCookieCache: true })
      : await getSession({ disableCookieCache: true });

    if (freshSession?.user?.emailVerified) {
      return freshSession;
    }
  }

  if (!session.user.emailVerified) {
    redirect("/auth/verify-email");
  }

  return session;
}
