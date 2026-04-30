import Image from "next/image";
import { redirect } from "next/navigation";

import { ActivityCard } from "@/components/app/activity-card";
import { EmptyState } from "@/components/app/empty-state";
import { AppHeader } from "@/components/app/app-header";
import { getInProgressEntries, getProfileStats, getViewerFeed } from "@/lib/feed";
import { ensureViewerProfile } from "@/lib/viewer-profile";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await ensureViewerProfile();

  if (!profile) {
    redirect("/auth/sign-in");
  }

  const [feed, inProgress, stats] = await Promise.all([
    getViewerFeed(profile.id, { includeAdultContent: profile.showAdultContent }),
    getInProgressEntries(profile.id, { includeAdultContent: profile.showAdultContent }),
    getProfileStats(profile.id),
  ]);

  return (
    <main className="app-shell animate-fade-in-up">
      <AppHeader avatarUrl={profile.avatarUrl} current="feed" nickname={profile.nickname} username={profile.username} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_22rem]">     
        <div className="space-y-4">
          <section className="section-head animate-fade-in-up animate-delay-100">
            <div>
              <p className="eyebrow">Feed</p>
              <h1 className="font-display text-4xl text-foreground">Recent Activity</h1>
            </div>
            <p className="max-w-xl text-sm leading-7 text-muted">
              Here you will see your updates. Once you start following people, their activities will appear here as well.
            </p>
          </section>

          <section className="space-y-3">
            {feed.length ? (
              feed.map((activity, index) => (
                <div key={activity.id} className="animate-fade-in-up" style={{ animationDelay: `${(index + 2) * 100}ms` }}>
                  <ActivityCard activity={activity} />
                </div>
              ))
            ) : (
              <EmptyState
                title="No timeline yet"
                description="Add your first anime or manga to start building your timeline."
                className="animate-fade-in-up animate-delay-200"
              />
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="panel interactive animate-fade-in-up animate-delay-200 space-y-4">
            <div className="space-y-1">
              <p className="eyebrow tracking-widest text-[10px] text-muted">Profile</p>
              <h2 className="font-display text-2xl text-foreground mt-1">{profile.nickname}</h2>
              <p className="text-xs text-muted tracking-wide mt-1">@{profile.username}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="stat-tile">
                <span>following</span>
                <strong>{stats.following}</strong>
              </div>
              <div className="stat-tile">
                <span>followers</span>
                <strong>{stats.followers}</strong>
              </div>
              <div className="stat-tile">
                <span>anime</span>
                <strong>{stats.animeEntries}</strong>
              </div>
              <div className="stat-tile">
                <span>manga</span>
                <strong>{stats.mangaEntries}</strong>
              </div>
            </div>
          </section>

          <section className="panel animate-fade-in-up animate-delay-300 space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow tracking-widest text-[10px] text-muted">In Progress</p>
                <h2 className="font-display text-2xl text-foreground mt-1">Active Tracking</h2>
              </div>
              <span className="text-xs text-muted/60">{inProgress.length}</span>   
            </div>

            {inProgress.length ? (
              <div className="space-y-3">
                {inProgress.map((entry) => (
                  <article className="progress-card group" key={`${entry.kind}-${entry.id}`}>
                    <div className="cover-wrapper relative aspect-[3/4] w-14 shrink-0 overflow-hidden border border-line bg-surface-strong">   
                      {entry.imageUrl ? (
                        <Image alt={entry.title ?? `MAL ${entry.malId}`} className="object-cover transition-transform duration-500 group-hover:scale-110" fill sizes="56px" src={entry.imageUrl} />
                      ) : null}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">{entry.kind}</p>
                      <p className="truncate text-sm text-foreground">{entry.title ?? `MAL ${entry.malId}`}</p>
                      <p className="text-xs text-muted">
                        {entry.kind === "anime" ? `episode ${entry.progress}` : `chapter ${entry.progress}`} | {entry.relativeTime}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nothing registered yet"
                description="Anime and manga you mark as watching or reading will appear here."
                className="animate-fade-in-up animate-delay-300"
              />
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}

