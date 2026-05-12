import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, eq, ilike, inArray, or } from "drizzle-orm";

import { AppHeader } from "@/components/app/app-header";
import { SearchResultCard } from "@/components/search/search-result-card";
import { UserSearchResultCard } from "@/components/search/user-search-result-card";
import { db } from "@/lib/db";
import { favoriteAnime, userAnimeList, userFollows, userMangaList, users } from "@/lib/db/schema";
import { searchMedia } from "@/lib/jikan/client";
import { ensureViewerProfile } from "@/lib/viewer-profile";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    type?: string;
  }>;
};

type SearchType = "anime" | "manga" | "users";

async function searchUsers(query: string) {
  const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
    })
    .from(users)
    .where(or(ilike(users.username, pattern), ilike(users.nickname, pattern)))
    .limit(30);

  return Promise.all(
    rows.map(async (user) => {
      const [followers, following] = await Promise.all([
        db
          .select({ count: count() })
          .from(userFollows)
          .where(eq(userFollows.followingId, user.id)),
        db
          .select({ count: count() })
          .from(userFollows)
          .where(eq(userFollows.followerId, user.id)),
      ]);

      return {
        ...user,
        followers: followers[0]?.count ?? 0,
        following: following[0]?.count ?? 0,
      };
    }),
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const profile = await ensureViewerProfile();

  if (!profile) {
    redirect("/auth/sign-in");
  }

  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const searchType: SearchType =
    params.type === "manga" || params.type === "users" ? params.type : "anime";
  const results = query && searchType !== "users"
    ? await searchMedia(query, searchType, {
        includeAdultContent: profile.showAdultContent,
      })
    : [];
  const userResults = query && searchType === "users" ? await searchUsers(query) : [];
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
      <AppHeader avatarUrl={profile.avatarUrl} nickname={profile.nickname} username={profile.username} viewerId={profile.id} />

      <section className="section-head">
        <div>
          <p className="eyebrow tracking-widest text-[10px] text-muted">Busca</p>
          <h1 className="font-display text-4xl text-foreground mt-1">Catalog</h1>
        </div>
        <p className="max-w-xl text-sm leading-7 text-muted mt-2">
          Choose a type to keep results focused.
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
              <Link
                className={`search-toggle-button ${searchType === "users" ? "search-toggle-button-active" : ""}`}
                href={`/search?q=${encodeURIComponent(query)}&type=users`}
              >
                People
              </Link>
            </div>
            <span className="text-sm text-muted">
              {searchType === "users" ? userResults.length : hydratedResults.length} results
            </span>
          </div>

          {searchType === "users" && userResults.length ? (
            <div className="space-y-3">
              {userResults.map((user) => (
                <UserSearchResultCard key={user.id} user={user} />
              ))}
            </div>
          ) : searchType !== "users" && hydratedResults.length ? (
            <div className="space-y-3">
              {hydratedResults.map((item) => (
                <SearchResultCard item={item} key={`${item.mediaType}-${item.malId}`} />
              ))}
            </div>
          ) : (
            <article className="panel">
              <p className="text-sm text-muted">Nenhum resultado encontrado.</p>
            </article>
          )}
        </section>
      ) : (
        <article className="panel">
          <p className="text-sm text-muted">Type a title in the search field above to get started.</p>
        </article>
      )}
    </main>
  );
}
