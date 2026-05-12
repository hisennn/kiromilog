import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { ProfileContent } from "@/components/profile/profile-content";
import { ProfileSocialActions } from "@/components/profile/profile-social-actions";

import {
  getProfileByUsername,
  getProfileConnections,
  getProfileFavoriteAnime,
  getProfileFeed,
  getProfileLibrary,
  getProfileStats,
  isLibraryEntryExplicit,
} from "@/lib/feed";
import { AnimeCachePayload, MangaCachePayload } from "@/lib/media-payload";
import { getFollowState } from "@/lib/social-actions";
import { ensureViewerProfile } from "@/lib/viewer-profile";

type ProfilePageProps = {
  params: Promise<{
    username: string;
  }>;
  searchParams?: Promise<{
    view?: string;
    filter?: string;
  }>;
};

type ProfileView = "timeline" | "anime" | "manga" | "followers" | "following";

function getProfileView(input?: string): ProfileView {
  if (
    input === "anime" ||
    input === "manga" ||
    input === "followers" ||
    input === "following"
  ) {
    return input;
  }

  return "timeline";
}

function getAverageScore(
  entries: Array<{
    score: number | null;
  }>,
) {
  const scoredEntries = entries.filter((entry) => typeof entry.score === "number" && entry.score > 0);

  if (!scoredEntries.length) {
    return null;
  }

  const total = scoredEntries.reduce((sum, entry) => sum + (entry.score ?? 0), 0);
  return (total / scoredEntries.length).toFixed(1);
}

function getCompletedAnimeProgress(entry: { status: string; progress: number; payload: unknown }) {
  const payload = entry.payload as AnimeCachePayload | null;
  const totalEpisodes = payload?.episodes ?? null;

  if (entry.status === "completed" && totalEpisodes && totalEpisodes > entry.progress) {
    return totalEpisodes;
  }

  return entry.progress || 0;
}

function getCompletedMangaProgress(entry: { status: string; progress: number; payload: unknown }) {
  const payload = entry.payload as MangaCachePayload | null;
  const totalChapters = payload?.chapters ?? null;

  if (entry.status === "completed" && totalChapters && totalChapters > entry.progress) {
    return totalChapters;
  }

  return entry.progress || 0;
}

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const viewer = await ensureViewerProfile();

  if (!viewer) {
    redirect("/auth/sign-in");
  }

  const { username } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const activeView = getProfileView(resolvedSearchParams?.view);
  const activeFilter = resolvedSearchParams?.filter ?? "all";
  const profile = await getProfileByUsername(username);
  const includeAdultContent = viewer.showAdultContent;

  if (!profile) {
    notFound();
  }

  const [
    feed,
    stats,
    animeLibrary,
    mangaLibrary,
    favoriteAnime,
    followState,
    connections,
  ] = await Promise.all([
    getProfileFeed(profile.id, { includeAdultContent, viewerId: viewer.id }),
    getProfileStats(profile.id),
    getProfileLibrary(profile.id, "anime"),
    getProfileLibrary(profile.id, "manga"),
    getProfileFavoriteAnime(profile.id, 12, { includeAdultContent }),
    getFollowState(viewer.id, profile.id),
    activeView === "followers" || activeView === "following"
      ? getProfileConnections(profile.id, activeView)
      : Promise.resolve([]),
  ]);
  const canEditProfile = viewer.id === profile.id;
  const visibleAnimeLibrary = animeLibrary;
  const visibleMangaLibrary = mangaLibrary;
  const unblockedAnimeLibrary = includeAdultContent
    ? animeLibrary
    : animeLibrary.filter((entry) => !isLibraryEntryExplicit(entry, "anime"));
  const unblockedMangaLibrary = includeAdultContent
    ? mangaLibrary
    : mangaLibrary.filter((entry) => !isLibraryEntryExplicit(entry, "manga"));
  const animeAverageScore = getAverageScore(unblockedAnimeLibrary);
  const mangaAverageScore = getAverageScore(unblockedMangaLibrary);

  const totalEpisodesWatched = unblockedAnimeLibrary.reduce(
    (sum, entry) => sum + getCompletedAnimeProgress(entry),
    0,
  );

  const totalChaptersRead = unblockedMangaLibrary.reduce(
    (sum, entry) => sum + getCompletedMangaProgress(entry),
    0,
  );
  const mappedAnimeLibrary = visibleAnimeLibrary.map((entry) => {
    const isExplicitBlocked =
      !includeAdultContent && isLibraryEntryExplicit(entry, "anime");

    return {
      isExplicitBlocked,
      id: entry.id,
      status: entry.status,
      malId: entry.malId,
      title: isExplicitBlocked ? "NSFW content" : entry.title,
      imageUrl: entry.imageUrl,
      score: entry.score,
      progress: entry.progress,
      type: (entry.payload as AnimeCachePayload | null)?.type ?? null,
      total: (entry.payload as AnimeCachePayload | null)?.episodes ?? null,
      isFavorite: "favoriteMalId" in entry && entry.favoriteMalId !== null,
    };
  });

  const mappedMangaLibrary = visibleMangaLibrary.map((entry) => {
    const isExplicitBlocked =
      !includeAdultContent && isLibraryEntryExplicit(entry, "manga");

    return {
      isExplicitBlocked,
      id: entry.id,
      status: entry.status,
      malId: entry.malId,
      title: isExplicitBlocked ? "NSFW content" : entry.title,
      imageUrl: entry.imageUrl,
      score: entry.score,
      progress: entry.progress,
      progressVolumes: (entry as { progressVolumes: number }).progressVolumes,
      type: (entry.payload as MangaCachePayload | null)?.type ?? null,
      total: (entry.payload as MangaCachePayload | null)?.chapters ?? null,
    };
  });
  const mappedFavoriteAnime = favoriteAnime.map((fav) => {
    const isExplicitBlocked =
      !includeAdultContent && isLibraryEntryExplicit(fav, "anime");

    return {
      ...fav,
      isExplicitBlocked,
      title: isExplicitBlocked ? "NSFW content" : fav.title,
      href: isExplicitBlocked ? "/settings" : `/anime/${fav.malId}`,
    };
  });
  return (
    <main className="app-shell">
      <AppHeader
        avatarUrl={viewer.avatarUrl}
        current={viewer.id === profile.id ? "profile" : null}
        nickname={viewer.nickname}
        username={viewer.username}
        viewerId={viewer.id}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-4">
        <aside className="lg:col-span-1 space-y-8 pr-4">
          <div className="flex flex-col animate-fade-in-up">
            {viewer.username === profile.username ? (
              <Link href="/settings#photo" className="group relative mb-4 block h-36 w-36 shrink-0 overflow-hidden rounded-sm border border-line bg-surface-strong">
                {profile.avatarUrl ? (
                  <Image alt={`@${profile.username}`} className="object-cover object-center transition-transform duration-300 group-hover:scale-105" fill loading="eager" sizes="144px" src={profile.avatarUrl} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-5xl font-display text-foreground">
                    {profile.username.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center border border-line bg-black/55 text-foreground opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 translate-y-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </span>
              </Link>
            ) : profile.avatarUrl ? (
              <div className="relative mb-4 h-36 w-36 shrink-0 overflow-hidden rounded-sm border border-line bg-surface-strong">
                <Image alt={`@${profile.username}`} className="object-cover object-center" fill loading="eager" sizes="144px" src={profile.avatarUrl} />
              </div>
            ) : (
              <div className="mb-4 flex h-36 w-36 shrink-0 items-center justify-center rounded-sm border border-line bg-surface-strong text-5xl font-display text-foreground">
                {profile.username.slice(0, 1).toUpperCase()}
              </div>
            )}
            
            <h1 className="font-display text-3xl font-medium text-foreground tracking-tight mb-2">@{profile.username}</h1>
            
            <div className="flex gap-8 mt-2 pb-6 border-b border-line/60">
              <Link
                className={`profile-stat-link flex flex-col ${
                  activeView === "followers" ? "profile-stat-link-active" : ""
                }`}
                href={`/u/${profile.username}?view=followers`}
              >
                <div className="font-semibold text-foreground text-xl leading-none">{stats.followers}</div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted/90 mt-2">followers</div>
              </Link>
              <Link
                className={`profile-stat-link flex flex-col ${
                  activeView === "following" ? "profile-stat-link-active" : ""
                }`}
                href={`/u/${profile.username}?view=following`}
              >
                <div className="font-semibold text-foreground text-xl leading-none">{stats.following}</div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted/90 mt-2">following</div>
              </Link>
            </div>

            {profile.bio && <p className="text-sm text-foreground mt-6 max-w-[200px] leading-relaxed">{profile.bio}</p>}
            {!followState.isSelf ? (
              <ProfileSocialActions
                isFollowedBy={followState.isFollowedBy}
                isFollowing={followState.isFollowing}
                isMutual={followState.isMutual}
                username={profile.username}
              />
            ) : null}
          </div>

          <div className="animate-fade-in-up animate-delay-100 space-y-8">
            <div>
              <h2 className="font-display text-[1.35rem] text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-foreground block"></span>
                Anime
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-baseline border-b border-line/40 pb-1.5">
                  <span className="text-muted/90 font-semibold tracking-widest uppercase text-[11px]">Watched</span>
                  <span className="font-semibold text-[15px] text-foreground">{stats.animeEntries}</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-line/40 pb-1.5">
                  <span className="text-muted/90 font-semibold tracking-widest uppercase text-[11px]">Episodes</span>
                  <span className="font-semibold text-[15px] text-foreground">{totalEpisodesWatched}</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-line/40 pb-1.5">
                  <span className="text-muted/90 font-semibold tracking-widest uppercase text-[11px]">Mean score</span>
                  <span className="font-semibold text-[15px] text-primary">{animeAverageScore ?? "-"}</span>
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-display text-[1.35rem] text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-foreground block"></span>
                Manga
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-baseline border-b border-line/40 pb-1.5">
                  <span className="text-muted/90 font-semibold tracking-widest uppercase text-[11px]">Read</span>
                  <span className="font-semibold text-[15px] text-foreground">{stats.mangaEntries}</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-line/40 pb-1.5">
                  <span className="text-muted/90 font-semibold tracking-widest uppercase text-[11px]">Chapters</span>
                  <span className="font-semibold text-[15px] text-foreground">{totalChaptersRead}</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-line/40 pb-1.5">
                  <span className="text-muted/90 font-semibold tracking-widest uppercase text-[11px]">Mean score</span>
                  <span className="font-semibold text-[15px] text-primary">{mangaAverageScore ?? "-"}</span>
                </div>
              </div>
            </div>
          </div>

          {mappedFavoriteAnime.length > 0 && (
            <div className="animate-fade-in-up animate-delay-200 pt-2">
              <h2 className="font-display text-lg text-foreground mb-3">Fav animes</h2>
              <div className="grid grid-cols-3 gap-1.5">
                {mappedFavoriteAnime.map((fav) => (
                  <Link
                    key={fav.id}
                    href={fav.href}
                    className="fav-card relative aspect-[3/4] w-full bg-surface-strong transition-opacity hover:opacity-80"
                    aria-label={fav.title ?? `Anime ${fav.malId}`}
                    data-title={fav.title ?? `Anime ${fav.malId}`}
                  >
                    <span className="absolute inset-0 overflow-hidden">
                    {fav.imageUrl && (
                      <Image
                        alt={fav.title ?? ""}
                        className={`object-cover ${
                          fav.isExplicitBlocked ? "scale-110 blur-sm opacity-50" : ""
                        }`}
                        fill
                        sizes="80px"
                        src={fav.imageUrl}
                      />
                    )}
                    {fav.isExplicitBlocked ? (
                      <span className="absolute inset-0 grid place-items-center bg-black/35 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                        +18
                      </span>
                    ) : null}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section className="lg:col-span-3 space-y-6">
          <ProfileContent
            animeLibrary={mappedAnimeLibrary}
            canEdit={canEditProfile}
            feed={feed}
            initialFilter={activeFilter}
            initialView={activeView}
            connections={connections}
            mangaLibrary={mappedMangaLibrary}
            username={profile.username}
          />
        </section>
      </div>
    </main>
  );
}
