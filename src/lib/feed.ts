import "server-only";

import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { isExplicitMediaPayload } from "@/lib/content-preferences";
import { db } from "@/lib/db";
import {
  activities,
  animeCache,
  favoriteAnime,
  mangaCache,
  userAnimeList,
  userFollows,
  userMangaList,
  users,
} from "@/lib/db/schema";
import { ActivityPayload } from "@/lib/media-payload";

export function formatRelativeTime(date: Date) {
  const deltaSeconds = Math.floor((date.getTime() - Date.now()) / 1000);
  const safeSeconds = deltaSeconds === 0 ? -1 : deltaSeconds;
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];

  for (const [unit, size] of ranges) {
    if (Math.abs(safeSeconds) >= size) {
      return formatter.format(Math.trunc(safeSeconds / size), unit);
    }
  }

  return formatter.format(safeSeconds, "second");
}

function mapActivity(item: {
  id: string;
  actorId: string;
  kind: "anime_progress" | "manga_progress" | "anime_status" | "manga_status" | "favorite_added";
  mediaKind: "anime" | "manga" | null;
  mediaMalId: number | null;
  status: string | null;
  progressFrom: number | null;
  progressTo: number | null;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
  username: string;
  nickname: string;
  avatarUrl: string | null;
}) {
  const payload = item.payload as ActivityPayload;

  return {
    ...item,
    title: payload.title ?? `MAL ${item.mediaMalId ?? "?"}`,
    imageUrl: payload.imageUrl ?? null,
    relativeTime: formatRelativeTime(item.createdAt),
  };
}

async function filterExplicitActivities<
  T extends {
    mediaKind: "anime" | "manga" | null;
    mediaMalId: number | null;
  },
>(items: T[], includeAdultContent: boolean) {
  if (includeAdultContent) {
    return items;
  }

  const animeIds = items
    .filter((item) => item.mediaKind === "anime" && item.mediaMalId !== null)
    .map((item) => item.mediaMalId as number);
  const mangaIds = items
    .filter((item) => item.mediaKind === "manga" && item.mediaMalId !== null)
    .map((item) => item.mediaMalId as number);

  const [animeEntries, mangaEntries] = await Promise.all([
    animeIds.length
      ? db
          .select({
            malId: animeCache.malId,
            payload: animeCache.payload,
          })
          .from(animeCache)
          .where(inArray(animeCache.malId, animeIds))
      : Promise.resolve([]),
    mangaIds.length
      ? db
          .select({
            malId: mangaCache.malId,
            payload: mangaCache.payload,
          })
          .from(mangaCache)
          .where(inArray(mangaCache.malId, mangaIds))
      : Promise.resolve([]),
  ]);

  const blockedAnimeIds = new Set(
    animeEntries
      .filter((entry) => isExplicitMediaPayload(entry.payload, "anime"))
      .map((entry) => entry.malId),
  );
  const blockedMangaIds = new Set(
    mangaEntries
      .filter((entry) => isExplicitMediaPayload(entry.payload, "manga"))
      .map((entry) => entry.malId),
  );

  return items.filter((item) => {
    if (item.mediaKind === "anime" && item.mediaMalId !== null) {
      return !blockedAnimeIds.has(item.mediaMalId);
    }

    if (item.mediaKind === "manga" && item.mediaMalId !== null) {
      return !blockedMangaIds.has(item.mediaMalId);
    }

    return true;
  });
}

export async function getViewerFeed(
  userId: string,
  options?: { includeAdultContent?: boolean },
) {
  const follows = await db
    .select({ followingId: userFollows.followingId })
    .from(userFollows)
    .where(eq(userFollows.followerId, userId));

  const actorIds = [userId, ...follows.map((item) => item.followingId)];

  const items = await db
    .select({
      id: activities.id,
      actorId: activities.actorId,
      kind: activities.kind,
      mediaKind: activities.mediaKind,
      mediaMalId: activities.mediaMalId,
      status: activities.status,
      progressFrom: activities.progressFrom,
      progressTo: activities.progressTo,
      payload: activities.payload,
      createdAt: activities.createdAt,
      updatedAt: activities.updatedAt,
      username: users.username,
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
    })
    .from(activities)
    .innerJoin(users, eq(users.id, activities.actorId))
    .where(inArray(activities.actorId, actorIds))
    .orderBy(desc(activities.createdAt))
    .limit(24);

  const visibleItems = await filterExplicitActivities(
    items,
    options?.includeAdultContent ?? false,
  );

  return visibleItems.map(mapActivity);
}

export async function getProfileFeed(
  actorId: string,
  options?: { includeAdultContent?: boolean },
) {
  const items = await db
    .select({
      id: activities.id,
      actorId: activities.actorId,
      kind: activities.kind,
      mediaKind: activities.mediaKind,
      mediaMalId: activities.mediaMalId,
      status: activities.status,
      progressFrom: activities.progressFrom,
      progressTo: activities.progressTo,
      payload: activities.payload,
      createdAt: activities.createdAt,
      updatedAt: activities.updatedAt,
      username: users.username,
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
    })
    .from(activities)
    .innerJoin(users, eq(users.id, activities.actorId))
    .where(eq(activities.actorId, actorId))
    .orderBy(desc(activities.createdAt))
    .limit(24);

  const visibleItems = await filterExplicitActivities(
    items,
    options?.includeAdultContent ?? false,
  );

  return visibleItems.map(mapActivity);
}

export async function getProfileByUsername(username: string) {
  const [profile] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return profile ?? null;
}

export async function getProfileStats(userId: string) {
  const [followers, following, animeTotal, mangaTotal] = await Promise.all([
    db.select({ count: count() }).from(userFollows).where(eq(userFollows.followingId, userId)),
    db.select({ count: count() }).from(userFollows).where(eq(userFollows.followerId, userId)),
    db.select({ count: count() }).from(userAnimeList).where(eq(userAnimeList.userId, userId)),
    db.select({ count: count() }).from(userMangaList).where(eq(userMangaList.userId, userId)),
  ]);

  return {
    followers: followers[0]?.count ?? 0,
    following: following[0]?.count ?? 0,
    animeEntries: animeTotal[0]?.count ?? 0,
    mangaEntries: mangaTotal[0]?.count ?? 0,
  };
}

export async function getProfileLibrary(userId: string, mediaType: "anime" | "manga") {
  if (mediaType === "anime") {
    return db
      .select({
        id: userAnimeList.id,
        status: userAnimeList.status,
        malId: userAnimeList.malId,
        title: animeCache.title,
        imageUrl: animeCache.imageUrl,
        score: userAnimeList.score,
        progress: userAnimeList.progressEpisodes,
        updatedAt: userAnimeList.updatedAt,
        payload: animeCache.payload,
        favoriteMalId: favoriteAnime.malId,
      })
      .from(userAnimeList)
      .leftJoin(animeCache, eq(animeCache.malId, userAnimeList.malId))
      .leftJoin(
        favoriteAnime,
        and(eq(favoriteAnime.userId, userId), eq(favoriteAnime.malId, userAnimeList.malId)),
      )
      .where(eq(userAnimeList.userId, userId))
      .orderBy(desc(userAnimeList.updatedAt));
  }

  return db
    .select({
      id: userMangaList.id,
      status: userMangaList.status,
      malId: userMangaList.malId,
      title: mangaCache.title,
      imageUrl: mangaCache.imageUrl,
      score: userMangaList.score,
      progress: userMangaList.progressChapters,
      progressVolumes: userMangaList.progressVolumes,
      updatedAt: userMangaList.updatedAt,
      payload: mangaCache.payload,
    })
    .from(userMangaList)
    .leftJoin(mangaCache, eq(mangaCache.malId, userMangaList.malId))
    .where(eq(userMangaList.userId, userId))
    .orderBy(desc(userMangaList.updatedAt));
}

export async function getProfileFavoriteAnime(
  userId: string,
  limit = 12,
  options?: { includeAdultContent?: boolean },
) {
  const favorites = await db
    .select({
      id: favoriteAnime.id,
      malId: favoriteAnime.malId,
      title: animeCache.title,
      imageUrl: animeCache.imageUrl,
      position: favoriteAnime.position,
      payload: animeCache.payload,
    })
    .from(favoriteAnime)
    .leftJoin(animeCache, eq(animeCache.malId, favoriteAnime.malId))
    .where(eq(favoriteAnime.userId, userId))
    .orderBy(asc(favoriteAnime.position), asc(favoriteAnime.createdAt))
    .limit(limit);

  if (options?.includeAdultContent) {
    return favorites;
  }

  return favorites.filter((entry) => !isExplicitMediaPayload(entry.payload, "anime"));
}

export async function getInProgressEntries(
  userId: string,
  options?: { includeAdultContent?: boolean },
) {
  const [anime, manga] = await Promise.all([
    db
      .select({
        id: userAnimeList.id,
        malId: userAnimeList.malId,
        title: animeCache.title,
        imageUrl: animeCache.imageUrl,
        progress: userAnimeList.progressEpisodes,
        score: userAnimeList.score,
        updatedAt: userAnimeList.updatedAt,
        status: userAnimeList.status,
        payload: animeCache.payload,
      })
      .from(userAnimeList)
      .leftJoin(animeCache, eq(animeCache.malId, userAnimeList.malId))
      .where(
        and(
          eq(userAnimeList.userId, userId),
          inArray(userAnimeList.status, ["watching", "rewatching"]),
        ),
      )
      .orderBy(desc(userAnimeList.updatedAt))
      .limit(12),
    db
      .select({
        id: userMangaList.id,
        malId: userMangaList.malId,
        title: mangaCache.title,
        imageUrl: mangaCache.imageUrl,
        progress: userMangaList.progressChapters,
        score: userMangaList.score,
        updatedAt: userMangaList.updatedAt,
        status: userMangaList.status,
        payload: mangaCache.payload,
      })
      .from(userMangaList)
      .leftJoin(mangaCache, eq(mangaCache.malId, userMangaList.malId))
      .where(
        and(
          eq(userMangaList.userId, userId),
          inArray(userMangaList.status, ["reading", "rereading"]),
        ),
      )
      .orderBy(desc(userMangaList.updatedAt))
      .limit(12),
  ]);

  const visibleAnime = options?.includeAdultContent
    ? anime
    : anime.filter((item) => !isExplicitMediaPayload(item.payload, "anime"));
  const visibleManga = options?.includeAdultContent
    ? manga
    : manga.filter((item) => !isExplicitMediaPayload(item.payload, "manga"));

  return [
    ...visibleAnime.map((item) => ({
      ...item,
      kind: "anime" as const,
      relativeTime: formatRelativeTime(item.updatedAt),
    })),
    ...visibleManga.map((item) => ({
      ...item,
      kind: "manga" as const,
      relativeTime: formatRelativeTime(item.updatedAt),
    })),
  ]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 8);
}
