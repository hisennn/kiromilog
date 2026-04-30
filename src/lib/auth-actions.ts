"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  auth,
  getSession,
} from "@/lib/auth/server";
import {
  getVerificationCooldownRemaining,
  PENDING_VERIFICATION_EMAIL_COOKIE,
  VERIFICATION_RESEND_COOKIE,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
} from "@/lib/auth/verification";
import type { AuthActionState } from "@/lib/validation/auth";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
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
    const session = await getSession({ disableCookieCache: true });

    if (session?.user) {
      return session;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return null;
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

  const { error } = await auth.signIn.email({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      error: "Email ou senha invalidos.",
    };
  }

  const session = await getFreshSignedInSession();

  if (!session?.user) {
    return {
      error: "Nao foi possivel iniciar a sessao agora.",
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
    name: readString(formData, "name"),
    email: readString(formData, "email"),
    password: readString(formData, "password"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { error } = await auth.signUp.email({
    name: parsed.data.name,
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      error: "Nao foi possivel criar a conta com esses dados.",
    };
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
      error: "Nao encontramos um email pendente de verificacao. Entre novamente para continuar.",
    };
  }

  const cooldownSeconds = await getVerificationCooldownState();

  if (cooldownSeconds > 0) {
    return {
      error: `Espere ${cooldownSeconds}s antes de pedir outro codigo.`,
      cooldownSeconds,
    };
  }

  const { error } = await getEmailOtpAuth().emailOtp.sendVerificationOtp({
    email,
    type: "email-verification",
  });

  if (error) {
    return {
      error: "Nao foi possivel reenviar o codigo agora. Tente novamente em instantes.",
    };
  }

  await setVerificationResendCookie();
  await setPendingVerificationEmailCookie(email);

  return {
    success: "Enviamos um novo codigo de verificacao para o seu email.",
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
      error: "Nao encontramos um email pendente de verificacao. Entre novamente para continuar.",
    };
  }

  const otp = readString(formData, "otp").trim();

  if (!/^\d{6,8}$/.test(otp)) {
    return {
      error: "Digite o codigo exatamente como ele chegou no email.",
    };
  }

  const { error } = await getEmailOtpAuth().emailOtp.verifyEmail({
    email,
    otp,
  });

  if (error) {
    return {
      error: "Codigo invalido ou expirado. Tente novamente.",
    };
  }

  await clearVerificationCookies();

  const freshSession = await getSession({ disableCookieCache: true });

  if (freshSession?.user?.emailVerified) {
    redirect("/home");
  }

  redirect("/auth/sign-in?verified=1");
}

export async function signOutAction() {
  await auth.signOut();
  redirect("/");
}
