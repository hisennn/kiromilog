import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/auth/server";
import { signInAction } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sign In",
};

export default async function SignInPage() {
  const session = await getSession();

  if (session?.user) {
    redirect(session.user.emailVerified ? "/home" : "/auth/verify-email");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel animate-fade-in-up">
        <AuthForm action={signInAction} mode="sign-in" />
      </section>
    </main>
  );
}
