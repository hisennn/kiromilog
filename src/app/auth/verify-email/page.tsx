import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VerifyEmailActions } from "@/components/auth/verify-email-actions";
import { getSession } from "@/lib/auth/server";
import {
  getVerificationCooldownRemaining,
  PENDING_VERIFICATION_EMAIL_COOKIE,
  VERIFICATION_RESEND_COOKIE,
} from "@/lib/auth/verification";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Verify Email",
};

type VerifyEmailPageProps = {
  searchParams?: Promise<{
    delivery?: string;
    sent?: string;
  }>;
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const session = await getSession({ disableCookieCache: true });
  const cookieStore = await cookies();
  const params = searchParams ? await searchParams : undefined;

  if (session?.user?.emailVerified) {
    redirect("/home");
  }

  const verificationSent = params?.sent === "1";
  const deliveryFailed = params?.delivery === "error";
  const pendingEmail = cookieStore.get(PENDING_VERIFICATION_EMAIL_COOKIE)?.value?.trim() ?? null;
  const verificationEmail = pendingEmail || session?.user?.email || null;
  const lastSentAt = Number(cookieStore.get(VERIFICATION_RESEND_COOKIE)?.value ?? "");
  const initialCooldownSeconds = Number.isFinite(lastSentAt)
    ? getVerificationCooldownRemaining(lastSentAt)
    : 0;

  return (
    <main className="auth-shell">
      <section className="auth-panel animate-fade-in-up space-y-4">
        {verificationEmail ? (
          <>
            {deliveryFailed ? (
              <div className="panel space-y-2">
                <p className="text-sm text-accent">
                  Your account was created, but the code was not sent on the first attempt.
                  Use the button below to resend it.
                </p>
              </div>
            ) : null}
            {verificationSent ? (
              <div className="panel space-y-2">
                <p className="text-sm text-primary">
                  We sent your verification code.
                </p>
              </div>
            ) : null}
            <VerifyEmailActions
              email={verificationEmail}
              initialCooldownSeconds={initialCooldownSeconds}
            />
          </>
        ) : (
          <div className="panel space-y-3">
            <p className="eyebrow">Check your email</p>
            <h1 className="font-display text-4xl text-foreground">
              Confirm your account to continue.
            </h1>
            <p className="max-w-xl text-sm leading-7 text-muted">
              Sign in with the same account you created. If needed, we will resend the code.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link className="button button-primary sm:min-w-40" href="/auth/sign-in">
                Sign in
              </Link>
              <Link className="button button-ghost sm:min-w-40" href="/auth/sign-up">
                Create account
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
