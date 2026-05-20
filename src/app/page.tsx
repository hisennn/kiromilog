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
            Kiromilog is your place for anime and manga.
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted">
            Save your lists, find profiles, and follow what matters without clutter.
          </p>
        </div>

        <nav className="flex items-center gap-2 text-sm">
          <Link className="button button-ghost" href="/auth/sign-in">
            Sign in
          </Link>
          <Link className="button button-primary" href="/auth/sign-up">
            Create account
          </Link>
        </nav>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="panel interactive animate-fade-in-up animate-delay-100">
          <p className="eyebrow">Kiromilog</p>
          <div className="mt-3 space-y-3 text-sm text-muted">
            <p>
              A simple way to save what you watch, what you read, and the people you want to follow.
            </p>
            <p>
              Profiles, lists, follows, and messages stay in one place.
            </p>
          </div>
        </article>

        <aside className="panel interactive animate-fade-in-up animate-delay-200">
          <p className="eyebrow">Start</p>
          <div className="mt-3 space-y-2 text-sm text-muted">
            <p>Build your list.</p>
            <p>Find people.</p>
            <p>Keep the conversation going.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

