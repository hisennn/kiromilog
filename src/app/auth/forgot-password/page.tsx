import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Forgot Password",
};

export default async function ForgotPasswordPage() {
  const session = await getSession();

  if (session?.user) {
    redirect(session.user.emailVerified ? "/home" : "/auth/verify-email");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel animate-fade-in-up">
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
