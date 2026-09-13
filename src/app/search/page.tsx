import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, asc, count, eq, ilike, inArray, or } from "drizzle-orm";

import { AppHeader } from "@/components/app/app-header";
import { CharacterSearchResultCard } from "@/components/search/character-search-result-card";
import { SearchResultCard } from "@/components/search/search-result-card";
import { UserSearchResultCard } from "@/components/search/user-search-result-card";
import { db } from "@/lib/db";
import { favoriteAnime, favoriteManga, userAnimeList, userFollows, userMangaList, users } from "@/lib/db/schema";
import { isCatalogUnavailable, searchCharacters, searchMediaPage } from "@/lib/jikan/client";
import { ensureViewerProfile } from "@/lib/viewer-profile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Search",
};

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    type?: string;
    page?: string;
  }>;
};

type SearchType = "anime" | "manga" | "characters" | "users";

const SEARCH_PAGE_SIZE = 20;

async function searchUsers(query: string, page: number) {
  const pattern = `%${query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const where = or(ilike(users.username, pattern), ilike(users.nickname, pattern));
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
      })
      .from(users)
      .where(where)
      .orderBy(asc(users.username), asc(users.id))
      .limit(SEARCH_PAGE_SIZE)
      .offset((page - 1) * SEARCH_PAGE_SIZE),
    db
      .select({ count: count() })
      .from(users)
      .where(where),
  ]);

  const rowIds = rows.map((row) => row.id);
  const [followerCounts, followingCounts] = rowIds.length
    ? await Promise.all([
        db
          .select({ userId: userFollows.followingId, count: count() })
          .from(userFollows)
          .where(inArray(userFollows.followingId, rowIds))
          .groupBy(userFollows.followingId),
        db
          .select({ userId: userFollows.followerId, count: count() })
          .from(userFollows)
          .where(inArray(userFollows.followerId, rowIds))
          .groupBy(userFollows.followerId),
      ])
    : [[], []];
  const followersByUserId = new Map(followerCounts.map((row) => [row.userId, row.count]));
  const followingByUserId = new Map(followingCounts.map((row) => [row.userId, row.count]));

  const items = rows.map(({ id, ...user }) => ({
    ...user,
    followers: followersByUserId.get(id) ?? 0,
    following: followingByUserId.get(id) ?? 0,
  }));

  const total = totalRows[0]?.count ?? 0;

  return {
    items,
    pagination: {
      currentPage: page,
      lastPage: Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE)),
      total,
    },
  };
}

function clampPage(input?: string) {
  const page = Number(input);

  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return Math.min(page, 1000);
}

function getSearchHref(query: string, type: SearchType, page = 1) {
  const params = new URLSearchParams({
    q: query,
    type,
  });

  if (page > 1) {
    params.set("page", String(page));
  }

  return `/search?${params.toString()}`;
}

function PaginationControls({
  query,
  type,
  currentPage,
  lastPage,
}: {
  query: string;
  type: SearchType;
  currentPage: number;
  lastPage: number;
}) {
  if (lastPage <= 1) {
    return null;
  }

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), lastPage);
  const prevPage = Math.max(1, safeCurrentPage - 1);
  const nextPage = Math.min(lastPage, safeCurrentPage + 1);
  const disabledLinkClass = "pointer-events-none opacity-40";

  return (
    <nav className="flex items-center justify-end gap-2" aria-label="Search pagination">
      <Link className={`button button-ghost ${safeCurrentPage === 1 ? disabledLinkClass : ""}`} href={getSearchHref(query, type, 1)} aria-label="First page">
        &lt;&lt;
      </Link>
      <Link className={`button button-ghost ${safeCurrentPage === 1 ? disabledLinkClass : ""}`} href={getSearchHref(query, type, prevPage)} aria-label="Previous page">
        &lt;
      </Link>
      <span className="px-2 text-sm text-muted">
        Page {safeCurrentPage} of {lastPage}
      </span>
      <Link className={`button button-ghost ${safeCurrentPage === lastPage ? disabledLinkClass : ""}`} href={getSearchHref(query, type, nextPage)} aria-label="Next page">
        &gt;
      </Link>
      <Link className={`button button-ghost ${safeCurrentPage === lastPage ? disabledLinkClass : ""}`} href={getSearchHref(query, type, lastPage)} aria-label="Last page">
        &gt;&gt;
      </Link>
    </nav>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const profile = await ensureViewerProfile();

  if (!profile) {
    redirect("/auth/sign-in");
  }

  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const page = clampPage(params.page);
  const searchType: SearchType =
    params.type === "manga" || params.type === "characters" || params.type === "users" ? params.type : "anime";
  let mediaResult: Awaited<ReturnType<typeof searchMediaPage>> | null = null;
  let characterResult: Awaited<ReturnType<typeof searchCharacters>> | null = null;
  let catalogUnavailable = false;

  if (query && (searchType === "anime" || searchType === "manga")) {
    try {
      mediaResult = await searchMediaPage(query, searchType, {
        includeAdultContent: profile.showAdultContent,
        limit: SEARCH_PAGE_SIZE,
        page,
      });
    } catch (error) {
      if (!isCatalogUnavailable(error)) {
        throw error;
      }

      catalogUnavailable = true;
    }
  }

  if (query && searchType === "characters") {
    try {
      characterResult = await searchCharacters(query, { limit: SEARCH_PAGE_SIZE, page });
    } catch (error) {
      if (!isCatalogUnavailable(error)) {
        throw error;
      }

      catalogUnavailable = true;
    }
  }

  const userResult = query && searchType === "users" ? await searchUsers(query, page) : null;
  const results = mediaResult?.items ?? [];
  const userResults = userResult?.items ?? [];
  const characterResults = characterResult?.items ?? [];
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
      : searchType === "manga" && resultIds.length
        ? db
            .select({
              malId: favoriteManga.malId,
            })
            .from(favoriteManga)
            .where(and(eq(favoriteManga.userId, profile.id), inArray(favoriteManga.malId, resultIds)))
      : Promise.resolve([]),
  ]);
  const existingEntryMap = new Map(existingEntries.map((entry) => [entry.malId, entry]));
  const favoriteAnimeIds = new Set(favoriteEntries.map((entry) => entry.malId));
  const hydratedResults = results.map((item) => ({
    ...item,
    libraryEntry: existingEntryMap.get(item.malId) ?? null,
    isFavorite: searchType === "anime" || searchType === "manga" ? favoriteAnimeIds.has(item.malId) : false,
  }));

  return (
    <main className="app-shell">
      <AppHeader avatarUrl={profile.avatarUrl} nickname={profile.nickname} username={profile.username} viewerId={profile.id} />

      <section className="section-head">
        <div>
          <p className="eyebrow tracking-widest text-[10px] text-muted">Search</p>
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
                href={getSearchHref(query, "anime")}
              >
                Anime
              </Link>
              <Link
                className={`search-toggle-button ${searchType === "manga" ? "search-toggle-button-active" : ""}`}
                href={getSearchHref(query, "manga")}
              >
                Manga
              </Link>
              <Link
                className={`search-toggle-button ${searchType === "characters" ? "search-toggle-button-active" : ""}`}
                href={getSearchHref(query, "characters")}
              >
                Characters
              </Link>
              <Link
                className={`search-toggle-button ${searchType === "users" ? "search-toggle-button-active" : ""}`}
                href={getSearchHref(query, "users")}
              >
                Users
              </Link>
            </div>
            <span className="text-sm text-muted">
              {searchType === "users"
                ? userResult?.pagination.total ?? userResults.length
                : searchType === "characters"
                  ? characterResult?.pagination.total ?? characterResults.length
                  : mediaResult?.pagination.total ?? hydratedResults.length} results
            </span>
          </div>

          {catalogUnavailable ? (
            <article className="panel">
              <p className="text-sm text-muted">
                The anime and manga catalog is temporarily unavailable. User search still works. Try again shortly.
              </p>
            </article>
          ) : null}

          {searchType === "users" && userResults.length ? (
            <div className="space-y-3">
              {userResults.map((user) => (
                <UserSearchResultCard key={user.username} user={user} />
              ))}
            </div>
          ) : searchType === "characters" && characterResults.length ? (
            <div className="space-y-3">
              {characterResults.map((item) => (
                <CharacterSearchResultCard item={item} key={item.malId} />
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
              <p className="text-sm text-muted">No results found.</p>
            </article>
          )}

          <PaginationControls
            query={query}
            type={searchType}
            currentPage={
              userResult?.pagination.currentPage ??
              characterResult?.pagination.currentPage ??
              mediaResult?.pagination.currentPage ??
              page
            }
            lastPage={
              userResult?.pagination.lastPage ??
              characterResult?.pagination.lastPage ??
              mediaResult?.pagination.lastPage ??
              1
            }
          />
        </section>
      ) : (
        <article className="panel">
          <p className="text-sm text-muted">Type a title in the search field above to get started.</p>
        </article>
      )}
    </main>
  );
}
