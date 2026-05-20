import { and, count, eq, ilike, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { favoriteAnime, favoriteManga, userAnimeList, userFollows, userMangaList, users } from "@/lib/db/schema";
import { searchCharacters, searchMedia } from "@/lib/jikan/client";
import {
  consumeRateLimit,
  getClientIpFromRequest,
  secondsUntilReset,
} from "@/lib/rate-limit";
import { navbarSearchSchema } from "@/lib/validation/media";
import { getViewerProfile } from "@/lib/viewer-profile";

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

export async function GET(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rateLimit = consumeRateLimit({
    key: `api:search:${ip}`,
    limit: 30,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many searches. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(secondsUntilReset(rateLimit.resetAt)),
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const parsedQuery = navbarSearchSchema.safeParse({ q: searchParams.get("q") ?? "" });

  if (!parsedQuery.success || parsedQuery.data.q.length < 2) {
    return NextResponse.json({ anime: [], manga: [], characters: [], users: [] });
  }

  const query = parsedQuery.data.q;

  try {
    const viewer = await getViewerProfile();
    const includeAdultContent = viewer?.showAdultContent ?? false;
    const anime = await searchMedia(query, "anime", { includeAdultContent });
    await new Promise((resolve) => setTimeout(resolve, 350));
    const [manga, characters, userResults] = await Promise.all([
      searchMedia(query, "manga", { includeAdultContent }),
      searchCharacters(query, { limit: 8 }),
      searchUsers(query),
    ]);

    if (!viewer) {
      return NextResponse.json({ anime, manga, characters: characters.items, users: userResults });
    }

    const animeIds = anime.map((item) => item.malId);
    const mangaIds = manga.map((item) => item.malId);

    const [animeEntries, mangaEntries, favoriteAnimeEntries, favoriteMangaEntries] = await Promise.all([
      animeIds.length
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
                eq(userAnimeList.userId, viewer.id),
                inArray(userAnimeList.malId, animeIds),
              ),
            )
        : Promise.resolve([]),
      mangaIds.length
        ? db
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
                eq(userMangaList.userId, viewer.id),
                inArray(userMangaList.malId, mangaIds),
              ),
            )
        : Promise.resolve([]),
      animeIds.length
        ? db
            .select({
              malId: favoriteAnime.malId,
            })
            .from(favoriteAnime)
            .where(and(eq(favoriteAnime.userId, viewer.id), inArray(favoriteAnime.malId, animeIds)))
        : Promise.resolve([]),
      mangaIds.length
        ? db
            .select({
              malId: favoriteManga.malId,
            })
            .from(favoriteManga)
            .where(and(eq(favoriteManga.userId, viewer.id), inArray(favoriteManga.malId, mangaIds)))
        : Promise.resolve([]),
    ]);

    const animeEntryMap = new Map(animeEntries.map((entry) => [entry.malId, entry]));
    const mangaEntryMap = new Map(mangaEntries.map((entry) => [entry.malId, entry]));
    const favoriteAnimeIds = new Set(favoriteAnimeEntries.map((entry) => entry.malId));
    const favoriteMangaIds = new Set(favoriteMangaEntries.map((entry) => entry.malId));

    return NextResponse.json({
      anime: anime.map((item) => ({
        ...item,
        libraryEntry: animeEntryMap.get(item.malId) ?? null,
        isFavorite: favoriteAnimeIds.has(item.malId),
      })),
      manga: manga.map((item) => ({
        ...item,
        libraryEntry: mangaEntryMap.get(item.malId) ?? null,
        isFavorite: favoriteMangaIds.has(item.malId),
      })),
      characters: characters.items,
      users: userResults,
    });
  } catch {
    return NextResponse.json({ anime: [], manga: [], characters: [], users: [] }, { status: 502 });
  }
}
