import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();

  if (session?.user) {
    redirect(session.user.emailVerified ? "/home" : "/auth/verify-email");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
      <header className="animate-fade-in-up flex flex-col gap-4 border-b border-line/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.28em] text-primary">      
            Kiromilog
          </p>
          <h1 className="font-display text-3xl text-foreground sm:text-4xl">    
            Anime and manga tracking with purpose, memory, and your own pace.
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted">
            List what you are watching, track progress without visual clutter,
            and turn recent activity into a meaningful history.
          </p>
        </div>

        <nav className="flex items-center gap-2 text-sm">
          <Link className="button button-ghost" href="/auth/sign-in">
            Log In
          </Link>
          <Link className="button button-primary" href="/auth/sign-up">
            Sign Up
          </Link>
        </nav>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="panel interactive animate-fade-in-up animate-delay-100">
          <p className="eyebrow">Proposal</p>
          <div className="mt-3 space-y-3 text-sm text-muted">
            <p>
              Kiromilog was born to be cleaner, more readable, and more
              personal. No bloated dashboards or meaningless decorative boxes.
            </p>
            <p>
              The authentication, database, and cache foundations are ready. Now, the app enters
              the login, profile tracking, and real search phase.
            </p>
          </div>
        </article>

        <aside className="panel interactive animate-fade-in-up animate-delay-200">
          <p className="eyebrow">First Release</p>
          <div className="mt-3 space-y-2 text-sm text-muted">
            <p>Email and password via Neon Auth</p>
            <p>Profile synchronized on first access</p>
            <p>Protected home ready to scale</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

