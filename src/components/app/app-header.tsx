import Image from "next/image";
import Link from "next/link";

import { signOutAction } from "@/lib/library-actions";

type AppHeaderProps = {
  nickname: string;
  username: string;
  avatarUrl?: string | null;
  current?: "feed" | "profile" | "settings" | null;
  searchQuery?: string;
};

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      className={`inline-block origin-center transition-all duration-200 ${active ? "!text-[#b82644] font-medium" : "text-muted nav-hover-link"}`}
      href={href}
    >
      {children}
    </Link>
  );
}

export function AppHeader({
  nickname,
  username,
  avatarUrl = null,
  current = null,
  searchQuery = "",
}: AppHeaderProps) {
  return (
    <header className="flex w-full items-center justify-between border-b border-line pb-4 mb-4">
      <div className="flex items-center gap-10">
        <Link className="font-display text-2xl font-medium tracking-tight text-foreground transition-colors hover:opacity-80" href="/home">
          Kiromilog.
        </Link>

        <nav className="flex items-center gap-5 text-sm uppercase tracking-wider">
          <NavLink href="/home" active={current === "feed"}>Feed</NavLink>
          <NavLink href={`/u/${username}`} active={current === "profile"}>Profile</NavLink>
        </nav>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative">
          <form action="/search" className="flex items-center">
            <input
              autoComplete="off"
              className="w-80 border border-line bg-transparent px-3 py-1.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-primary hover:border-line/80"
              defaultValue={searchQuery}
              name="q"
              placeholder="Search..."
              type="search"
            />
            <div className="absolute right-3 text-muted pointer-events-none" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
          </form>
        </div>

        <div className="header-account">
          <button className="header-account-trigger" type="button">
            {avatarUrl ? (
              <span aria-hidden="true" className="relative flex h-7 w-7 shrink-0 overflow-hidden bg-surface-strong ring-1 ring-line">
                <Image alt="" className="object-cover object-center" fill sizes="28px" src={avatarUrl} />
              </span>
            ) : (
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center bg-surface-strong text-xs font-bold text-foreground ring-1 ring-line">
                {nickname.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="header-account-handle ml-1">@{username}</span>
            <span aria-hidden="true" className="header-account-caret">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </button>

          <div className="header-account-menu border border-line bg-background shadow-xl absolute right-0 mt-2 min-w-[200px] p-2">
            <div className="space-y-1 pb-3 px-2 border-b border-line mb-2">
              <p className="text-sm font-medium text-foreground">{nickname}</p>
              <p className="text-xs text-muted">@{username}</p>
            </div>
            <Link className="flex w-full px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-strong" href={`/u/${username}`}>
              <span>Profile</span>
            </Link>
            <Link className="flex w-full px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-strong" href="/settings">
              <span>Settings</span>
            </Link>
            <form action={signOutAction} className="mt-2 pt-2 border-t border-line">
              <button className="flex w-full items-center justify-between px-2 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-500/10" type="submit">
                <span>Logout</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" x2="9" y1="12" y2="12" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
