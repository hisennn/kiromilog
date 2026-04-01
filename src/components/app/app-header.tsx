import Link from "next/link";

import { signOutAction } from "@/lib/library-actions";

type AppHeaderProps = {
  nickname: string;
  username: string;
  current?: "feed" | "profile";
  searchQuery?: string;
};

export function AppHeader({
  nickname,
  username,
  current = "feed",
  searchQuery = "",
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="header-main-row">
        <div className="header-brand-row">
          <Link className="header-brand eyebrow transition-colors hover:text-primary" href="/home">
            KIROMILOG
          </Link>
        </div>

        <div className="header-center">
          <nav className="nav-group flex items-center gap-3 text-sm">
            <Link className={`nav-link ${current === "feed" ? "nav-link-active" : ""}`} href="/home">
              Feed
            </Link>
            <Link className={`nav-link ${current === "profile" ? "nav-link-active" : ""}`} href={`/u/${username}`}>
              Profile
            </Link>
          </nav>

          <div className="header-search">
            <form action="/search" className="header-search-shell">
              <input
                autoComplete="off"
                className="search-input header-search-input w-full pr-10"
                defaultValue={searchQuery}
                name="q"
                placeholder="Search anime or manga"
                type="search"
              />
              <div className="header-search-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
            </form>
          </div>
        </div>

        <div className="header-actions">
          <div className="header-account">
            <button className="header-account-trigger" type="button">
              <span aria-hidden="true" className="header-account-avatar">
                {nickname.slice(0, 1).toUpperCase()}
              </span>
              <span className="header-account-handle">@{username}</span>
              <span aria-hidden="true" className="header-account-caret">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </button>

            <div className="header-account-menu panel">
              <div className="space-y-1 pb-3">
                <p className="text-sm text-foreground">{nickname}</p>
                <p className="text-xs text-muted">@{username}</p>
              </div>
              <Link className="header-account-link" href={`/u/${username}`}>
                Profile
              </Link>
              <Link className="header-account-link" href="/settings">
                Settings
              </Link>
              <div className="header-account-separator" />
              <form action={signOutAction}>
                <button className="header-account-link header-account-logout text-red-400 hover:text-red-300 hover:bg-red-400/10" type="submit">
                  <span>Logout</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" x2="9" y1="12" y2="12" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}