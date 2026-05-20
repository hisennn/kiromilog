"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import {
  auth,
  getSession,
  getSessionWithCookieMutation,
} from "@/lib/auth/server";
import { db, sql as rawSql } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  getVerificationCooldownRemaining,
  PENDING_VERIFICATION_EMAIL_COOKIE,
  VERIFICATION_RESEND_COOKIE,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
} from "@/lib/auth/verification";
import {
  consumeRateLimit,
  getClientIpFromCurrentRequest,
  secondsUntilReset,
} from "@/lib/rate-limit";
import type { AuthActionState } from "@/lib/validation/auth";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function normalizePublicNickname(input: string) {
  return input.trim().toLowerCase();
}

function normalizeEmail(input: string) {
  return input.trim().toLowerCase();
}

type EmailOtpMethods = {
  sendVerificationOtp(input: {
    email: string;
    type: "email-verification";
  }): Promise<{ error: { message?: string } | null }>;
  verifyEmail(input: {
    email: string;
    otp: string;
  }): Promise<{ error: { message?: string } | null }>;
};

function getEmailOtpAuth() {
  return auth as typeof auth & {
    emailOtp: EmailOtpMethods;
  };
}

async function getFreshSignedInSession() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const session = await getSessionWithCookieMutation({
      disableCookieCache: false,
    });

    if (session?.user) {
      return session;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return null;
}

function isUniqueConstraintError(error: unknown, constraint: string) {
  return (
    error instanceof Error &&
    (error.message.includes(constraint) || error.message.includes("duplicate key"))
  );
}

async function hasAuthPasswordCredential(email: string) {
  const rows = await rawSql`
    select exists (
      select 1
      from neon_auth."user" auth_user
      inner join neon_auth.account account on account."userId" = auth_user.id
      where lower(auth_user.email) = ${email}
        and account."providerId" = 'credential'
        and account.password is not null
    ) as exists
  `;

  return Boolean(rows[0]?.exists);
}

async function setVerificationResendCookie() {
  const cookieStore = await cookies();
  cookieStore.set({
    name: VERIFICATION_RESEND_COOKIE,
    value: String(Date.now()),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VERIFICATION_RESEND_COOLDOWN_SECONDS,
  });
}

async function setPendingVerificationEmailCookie(email: string) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: PENDING_VERIFICATION_EMAIL_COOKIE,
    value: email,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 30,
  });
}

async function clearVerificationCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_VERIFICATION_EMAIL_COOKIE);
  cookieStore.delete(VERIFICATION_RESEND_COOKIE);
}

async function resolvePendingVerificationEmail(formData?: FormData) {
  const cookieStore = await cookies();
  const cookieEmail = cookieStore.get(PENDING_VERIFICATION_EMAIL_COOKIE)?.value?.trim();

  if (cookieEmail) {
    return cookieEmail;
  }

  const formEmail = formData ? readString(formData, "email").trim() : "";
  return formEmail || null;
}

async function getVerificationCooldownState() {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(VERIFICATION_RESEND_COOKIE)?.value;
  const lastSentAt = rawValue ? Number(rawValue) : null;

  if (!lastSentAt || !Number.isFinite(lastSentAt)) {
    return 0;
  }

  return getVerificationCooldownRemaining(lastSentAt);
}

async function checkAuthRateLimit(
  action: string,
  identity: string,
  limit: number,
  windowMs: number,
) {
  const ip = await getClientIpFromCurrentRequest();
  const result = consumeRateLimit({
    key: `auth:${action}:${ip}:${identity.toLowerCase()}`,
    limit,
    windowMs,
  });

  if (result.allowed) {
    return null;
  }

  return secondsUntilReset(result.resetAt);
}

export async function signInAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: readString(formData, "email"),
    password: readString(formData, "password"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const email = normalizeEmail(parsed.data.email);
  const waitSeconds = await checkAuthRateLimit(
    "sign-in",
    email,
    8,
    60 * 1000,
  );

  if (waitSeconds) {
    return {
      error: `Too many attempts. Try again in ${waitSeconds}s.`,
    };
  }

  const [profileUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (profileUser && !(await hasAuthPasswordCredential(email))) {
    return {
      error: "This profile exists, but it does not have a password account yet. Create the account again with the same email to repair it.",
    };
  }

  const { data, error } = await auth.signIn.email({
    email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      error: "Invalid email or password.",
    };
  }

  const session = data?.user
    ? {
        user: data.user,
      }
    : await getFreshSignedInSession();

  if (!session?.user) {
    return {
      error: "Could not start your session right now.",
    };
  }

  if (!session.user.emailVerified) {
    await setPendingVerificationEmailCookie(session.user.email);
    redirect("/auth/verify-email");
  }

  redirect("/home");
}

export async function signUpAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    nickname: readString(formData, "nickname"),
    email: readString(formData, "email"),
    password: readString(formData, "password"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const email = normalizeEmail(parsed.data.email);
  const waitSeconds = await checkAuthRateLimit(
    "sign-up",
    email,
    4,
    60 * 60 * 1000,
  );

  if (waitSeconds) {
    return {
      error: `Too many attempts. Try again in ${waitSeconds}s.`,
    };
  }

  const normalizedNickname = normalizePublicNickname(parsed.data.nickname);
  const [existingNicknameUser] = await db
    .select({
      email: users.email,
      username: users.username,
    })
    .from(users)
    .where(eq(users.username, normalizedNickname))
    .limit(1);
  const [existingEmailUser] = await db
    .select({
      email: users.email,
      username: users.username,
      nickname: users.nickname,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingNicknameUser && existingNicknameUser.email !== email) {
    return {
      fieldErrors: {
        nickname: ["This nickname is already in use."],
      },
    };
  }

  if (existingEmailUser && (await hasAuthPasswordCredential(email))) {
    return {
      fieldErrors: {
        email: ["This email is already registered."],
      },
    };
  }

  const { data, error } = await auth.signUp.email({
    name: normalizedNickname,
    email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      error: "Could not create an account with those details.",
    };
  }

  if (!data?.user) {
    return {
      error: "Could not create your account right now.",
    };
  }

  try {
    if (existingEmailUser) {
      await db
        .update(users)
        .set({
          id: data.user.id,
          email: data.user.email,
          username: existingEmailUser.username,
          nickname: existingEmailUser.nickname,
          avatarUrl: data.user.image ?? null,
          updatedAt: new Date(),
        })
        .where(eq(users.email, email));
    } else {
      await db.insert(users).values({
        id: data.user.id,
        email: data.user.email,
        username: normalizedNickname,
        nickname: normalizedNickname,
        avatarUrl: data.user.image ?? null,
        onboardingCompleted: false,
        updatedAt: new Date(),
      });
    }
  } catch (insertError) {
    if (isUniqueConstraintError(insertError, "users_username_unique")) {
      return {
        fieldErrors: {
          nickname: ["This nickname is already in use."],
        },
      };
    }

    if (isUniqueConstraintError(insertError, "users_email_unique")) {
      return {
        fieldErrors: {
          email: ["This email is already registered."],
        },
      };
    }

    throw insertError;
  }

  await setPendingVerificationEmailCookie(email);
  await setVerificationResendCookie();
  redirect("/auth/verify-email?sent=1");
}

export async function resendVerificationEmailAction(
  _state: AuthActionState,
  _formData: FormData,
): Promise<AuthActionState> {
  void _state;
  void _formData;

  const session = await getSession({ disableCookieCache: true });

  if (session?.user?.emailVerified) {
    await clearVerificationCookies();
    redirect("/home");
  }

  const email = await resolvePendingVerificationEmail(_formData);

  if (!email) {
    return {
      error: "We could not find a pending email. Sign in again to continue.",
    };
  }

  const waitSeconds = await checkAuthRateLimit(
    "resend-verification",
    email,
    3,
    15 * 60 * 1000,
  );

  if (waitSeconds) {
    return {
      error: `Too many requests. Try again in ${waitSeconds}s.`,
      cooldownSeconds: waitSeconds,
    };
  }

  const cooldownSeconds = await getVerificationCooldownState();

  if (cooldownSeconds > 0) {
    return {
      error: `Wait ${cooldownSeconds}s before requesting another code.`,
      cooldownSeconds,
    };
  }

  const { error } = await getEmailOtpAuth().emailOtp.sendVerificationOtp({
    email,
    type: "email-verification",
  });

  if (error) {
    return {
      error: "Could not resend the code right now. Try again shortly.",
    };
  }

  await setVerificationResendCookie();
  await setPendingVerificationEmailCookie(email);

  return {
    success: "We sent a new code to your email.",
    cooldownSeconds: VERIFICATION_RESEND_COOLDOWN_SECONDS,
  };
}

export async function verifyEmailCodeAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  void _state;

  const session = await getSession({ disableCookieCache: true });

  if (session?.user?.emailVerified) {
    await clearVerificationCookies();
    redirect("/home");
  }

  const email = await resolvePendingVerificationEmail(formData);

  if (!email) {
    return {
      error: "We could not find a pending email. Sign in again to continue.",
    };
  }

  const waitSeconds = await checkAuthRateLimit(
    "verify-email",
    email,
    10,
    15 * 60 * 1000,
  );

  if (waitSeconds) {
    return {
      error: `Too many attempts. Try again in ${waitSeconds}s.`,
    };
  }

  const otp = readString(formData, "otp").trim();

  if (!/^\d{6,8}$/.test(otp)) {
    return {
      error: "Enter the code exactly as it arrived in your email.",
    };
  }

  const { error } = await getEmailOtpAuth().emailOtp.verifyEmail({
    email,
    otp,
  });

  if (error) {
    return {
      error: "Invalid or expired code. Try again.",
    };
  }

  await clearVerificationCookies();

  const freshSession = await getSessionWithCookieMutation({
    disableCookieCache: false,
  });

  if (freshSession?.user?.emailVerified) {
    redirect("/home");
  }

  redirect("/auth/sign-in?verified=1");
}

export async function signOutAction() {
  await auth.signOut();
  redirect("/");
}
