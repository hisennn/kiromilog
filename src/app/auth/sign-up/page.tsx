import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/auth/server";
import { signUpAction } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const session = await getSession();

  if (session?.user) {
    redirect(session.user.emailVerified ? "/home" : "/auth/verify-email");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel animate-fade-in-up">
        <AuthForm action={signUpAction} mode="sign-up" />
      </section>
    </main>
  );
}
