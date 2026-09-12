import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reset Password",
};

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const session = await getSession();

  if (session?.user) {
    redirect(session.user.emailVerified ? "/home" : "/auth/verify-email");
  }

  const params = await searchParams;
  const token = (params.token ?? "").trim();

  return (
    <main className="auth-shell">
      <section className="auth-panel animate-fade-in-up">
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="eyebrow">Recovery</p>
              <h1 className="font-display text-4xl text-foreground">Invalid reset link.</h1>
              <p className="max-w-md text-base text-muted">
                This link is missing its token. Request a new one.
              </p>
            </div>
            <Link className="button button-primary sm:min-w-40" href="/auth/forgot-password">
              Request new link
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
