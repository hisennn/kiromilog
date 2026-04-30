import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";

import { AppHeader } from "@/components/app/app-header";
import { SearchResultCard } from "@/components/search/search-result-card";
import { db } from "@/lib/db";
import { favoriteAnime, userAnimeList, userMangaList } from "@/lib/db/schema";
import { searchMedia } from "@/lib/jikan/client";
import { ensureViewerProfile } from "@/lib/viewer-profile";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    type?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const profile = await ensureViewerProfile();

  if (!profile) {
    redirect("/auth/sign-in");
  }

  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const searchType = params.type === "manga" ? "manga" : "anime";
  const results = query
    ? await searchMedia(query, searchType, {
        includeAdultContent: profile.showAdultContent,
      })
    : [];
  const resultIds = results.map((item) => item.malId);
  const [existingEntries, favoriteEntries] = await Promise.all([
    resultIds.length === 0
      ? Promise.resolve([])
      : searchType === "anime"
        ? db
            .select({
              malId: userAnimeList.malId,
              status: userAnimeList.status,
              score: userAnimeList.score,
              progressEpisodes: userAnimeList.progressEpisodes,
            })
            .from(userAnimeList)
            .where(
              and(
                eq(userAnimeList.userId, profile.id),
                inArray(userAnimeList.malId, resultIds),
              ),
            )
        : db
            .select({
              malId: userMangaList.malId,
              status: userMangaList.status,
              score: userMangaList.score,
              progressChapters: userMangaList.progressChapters,
              progressVolumes: userMangaList.progressVolumes,
            })
            .from(userMangaList)
            .where(
              and(
                eq(userMangaList.userId, profile.id),
                inArray(userMangaList.malId, resultIds),
              ),
            ),
    searchType === "anime" && resultIds.length
      ? db
          .select({
            malId: favoriteAnime.malId,
          })
          .from(favoriteAnime)
          .where(and(eq(favoriteAnime.userId, profile.id), inArray(favoriteAnime.malId, resultIds)))
      : Promise.resolve([]),
  ]);
  const existingEntryMap = new Map(existingEntries.map((entry) => [entry.malId, entry]));
  const favoriteAnimeIds = new Set(favoriteEntries.map((entry) => entry.malId));
  const hydratedResults = results.map((item) => ({
    ...item,
    libraryEntry: existingEntryMap.get(item.malId) ?? null,
    isFavorite: searchType === "anime" ? favoriteAnimeIds.has(item.malId) : false,
  }));

  return (
    <main className="app-shell">
      <AppHeader avatarUrl={profile.avatarUrl} nickname={profile.nickname} username={profile.username} />

      <section className="section-head">
        <div>
          <p className="eyebrow tracking-widest text-[10px] text-muted">Search</p>
          <h1 className="font-display text-4xl text-foreground mt-1">Browse catalog</h1>
        </div>
        <p className="max-w-xl text-sm leading-7 text-muted mt-2">
          Pick a type above the list to keep your search focused on anime or manga without mixing results.
        </p>
      </section>

      {query ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="search-toggle">
              <Link
                className={`search-toggle-button ${searchType === "anime" ? "search-toggle-button-active" : ""}`}
                href={`/search?q=${encodeURIComponent(query)}&type=anime`}
              >
                Anime
              </Link>
              <Link
                className={`search-toggle-button ${searchType === "manga" ? "search-toggle-button-active" : ""}`}
                href={`/search?q=${encodeURIComponent(query)}&type=manga`}
              >
                Manga
              </Link>
            </div>
            <span className="text-sm text-muted">{hydratedResults.length} results</span>
          </div>

          {hydratedResults.length ? (
            <div className="space-y-3">
              {hydratedResults.map((item) => (
                <SearchResultCard item={item} key={`${item.mediaType}-${item.malId}`} />
              ))}
            </div>
          ) : (
            <article className="panel">
              <p className="text-sm text-muted">No results found for this search.</p>
            </article>
          )}
        </section>
      ) : (
        <article className="panel">
          <p className="text-sm text-muted">Type a title in the search bar above to get started.</p>
        </article>
      )}
    </main>
  );
}
