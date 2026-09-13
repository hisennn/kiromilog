"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, or } from "drizzle-orm";

import {
  auth,
  getSession,
  getSessionWithCookieMutation,
} from "@/lib/auth/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { env } from "@/lib/env";
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
import {
  changePasswordSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";
import { completeAccountDeletion, prepareAccountDeletion } from "@/lib/account-deletion";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function normalizePublicNickname(input: string) {
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
  ipLimit?: { limit: number; windowMs: number },
) {
  const ip = await getClientIpFromCurrentRequest();
  const [identityResult, ipResult] = await Promise.all([
    consumeRateLimit({
      key: `auth:${action}:${ip}:${identity.toLowerCase()}`,
      limit,
      windowMs,
      failClosed: true,
    }),
    ipLimit
      ? consumeRateLimit({
          key: `auth:${action}:ip:${ip}`,
          limit: ipLimit.limit,
          windowMs: ipLimit.windowMs,
          failClosed: true,
        })
      : Promise.resolve(null),
  ]);

  if (!identityResult.allowed) {
    return secondsUntilReset(identityResult.resetAt);
  }

  if (ipResult && !ipResult.allowed) {
    return secondsUntilReset(ipResult.resetAt);
  }

  return null;
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

  const waitSeconds = await checkAuthRateLimit(
    "sign-in",
    parsed.data.email,
    8,
    60 * 1000,
    { limit: 120, windowMs: 60 * 1000 },
  );

  if (waitSeconds) {
    return {
      error: `Too many attempts. Try again in ${waitSeconds}s.`,
    };
  }

  const { data, error } = await auth.signIn.email({
    email: parsed.data.email,
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

  const waitSeconds = await checkAuthRateLimit(
    "sign-up",
    parsed.data.email,
    4,
    60 * 60 * 1000,
    { limit: 20, windowMs: 60 * 60 * 1000 },
  );

  if (waitSeconds) {
    return {
      error: `Too many attempts. Try again in ${waitSeconds}s.`,
    };
  }

  const normalizedNickname = normalizePublicNickname(parsed.data.nickname);
  const [existingUser] = await db
    .select({
      email: users.email,
      username: users.username,
    })
    .from(users)
    .where(
      or(
        eq(users.username, normalizedNickname),
        eq(users.email, parsed.data.email),
      ),
    )
    .limit(1);

  if (existingUser?.username === normalizedNickname || existingUser?.email === parsed.data.email) {
    return {
      error: "Could not create an account with those details.",
    };
  }

  const { data, error } = await auth.signUp.email({
    name: normalizedNickname,
    email: parsed.data.email,
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
    await db.insert(users).values({
      id: data.user.id,
      email: data.user.email,
      username: normalizedNickname,
      nickname: normalizedNickname,
      avatarUrl: data.user.image ?? null,
      updatedAt: new Date(),
    });
  } catch (insertError) {
    if (isUniqueConstraintError(insertError, "users_username_unique")) {
      return {
        error: "Could not create an account with those details.",
      };
    }

    if (isUniqueConstraintError(insertError, "users_email_unique")) {
      return {
        error: "Could not create an account with those details.",
      };
    }

    throw insertError;
  }

  await setPendingVerificationEmailCookie(parsed.data.email);
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

export async function requestPasswordResetAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = requestPasswordResetSchema.safeParse({
    email: readString(formData, "email"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const waitSeconds = await checkAuthRateLimit(
    "reset-request",
    parsed.data.email,
    3,
    15 * 60 * 1000,
    { limit: 10, windowMs: 60 * 60 * 1000 },
  );

  if (waitSeconds) {
    return {
      error: `Too many requests. Try again in ${waitSeconds}s.`,
    };
  }

  await auth
    .requestPasswordReset({
      email: parsed.data.email,
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    })
    .catch(() => null);

  return {
    success: "If an account exists for this email, we sent a reset link.",
  };
}

export async function resetPasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: readString(formData, "token"),
    newPassword: readString(formData, "newPassword"),
  });

  if (!parsed.success) {
    const passwordIssue = parsed.error.issues.find((issue) => issue.path[0] === "newPassword");

    if (passwordIssue) {
      return { fieldErrors: { password: [passwordIssue.message] } };
    }

    return { error: "Invalid reset link. Request a new one." };
  }

  const waitSeconds = await checkAuthRateLimit(
    "reset-password",
    parsed.data.token,
    10,
    15 * 60 * 1000,
  );

  if (waitSeconds) {
    return {
      error: `Too many attempts. Try again in ${waitSeconds}s.`,
    };
  }

  const { error } = await auth.resetPassword({
    newPassword: parsed.data.newPassword,
    token: parsed.data.token,
  });

  if (error) {
    return { error: "Invalid or expired link. Request a new one." };
  }

  redirect("/auth/sign-in");
}

export async function changePasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const session = await getSession({ disableCookieCache: true });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: readString(formData, "currentPassword"),
    newPassword: readString(formData, "newPassword"),
  });

  if (!parsed.success) {
    const passwordIssue = parsed.error.issues.find((issue) => issue.path[0] === "newPassword");

    if (passwordIssue) {
      return { fieldErrors: { password: [passwordIssue.message] } };
    }

    return { error: "Could not update your password." };
  }

  const waitSeconds = await checkAuthRateLimit(
    "change-password",
    session.user.id,
    10,
    15 * 60 * 1000,
  );

  if (waitSeconds) {
    return {
      error: `Too many attempts. Try again in ${waitSeconds}s.`,
    };
  }

  const { error } = await auth.changePassword({
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
    revokeOtherSessions: true,
  });

  if (error) {
    return { error: "Current password is incorrect." };
  }

  return { success: "Password updated." };
}

export async function deleteAccountAction(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const session = await getSession({ disableCookieCache: true });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const userId = session.user.id;
  const ip = await getClientIpFromCurrentRequest();
  const rateLimit = await consumeRateLimit({
    key: `account:delete:${ip}:${userId}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });

  if (!rateLimit.allowed) {
    return { ok: false, message: "Too many requests. Try again later." };
  }

  try {
    await prepareAccountDeletion(userId);
    const { error } = await auth.deleteUser();

    if (error) {
      return { ok: false, message: "Could not delete your account right now." };
    }
  } catch {
    return { ok: false, message: "Could not delete your account right now." };
  }

  try {
    await completeAccountDeletion(userId);
  } catch {
    console.error("Account deleted from Auth; cleanup queued for retry.");
  }

  redirect("/");
}
