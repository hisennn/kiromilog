import "server-only";

import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { isExplicitMediaPayload } from "@/lib/content-preferences";
import { db } from "@/lib/db";
import {
  activities,
  activityLikes,
  animeCache,
  characterCache,
  favoriteAnime,
  favoriteCharacters,
  favoriteManga,
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
  const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
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
  likeCount?: number;
  isLikedByViewer?: boolean;
  isExplicitBlocked?: boolean;
}) {
  const payload = item.payload as ActivityPayload;
  const isExplicitBlocked = item.isExplicitBlocked ?? false;

  return {
    ...item,
    title: isExplicitBlocked
      ? "NSFW content"
      : payload.title ?? `MAL ${item.mediaMalId ?? "?"}`,
    imageUrl: payload.imageUrl ?? null,
    likeCount: item.likeCount ?? 0,
    isLikedByViewer: item.isLikedByViewer ?? false,
    isExplicitBlocked,
    relativeTime: formatRelativeTime(item.createdAt),
  };
}

async function hydrateActivityLikes<
  T extends {
    id: string;
  },
>(items: T[], viewerId: string) {
  const activityIds = items.map((item) => item.id);

  if (!activityIds.length) {
    return items.map((item) => ({
      ...item,
      likeCount: 0,
      isLikedByViewer: false,
    }));
  }

  const [likeRows, viewerLikeRows] = await Promise.all([
    db
      .select({
        activityId: activityLikes.activityId,
        count: count(),
      })
      .from(activityLikes)
      .where(inArray(activityLikes.activityId, activityIds))
      .groupBy(activityLikes.activityId),
    db
      .select({
        activityId: activityLikes.activityId,
      })
      .from(activityLikes)
      .where(
        and(
          eq(activityLikes.userId, viewerId),
          inArray(activityLikes.activityId, activityIds),
        ),
      ),
  ]);

  const countByActivityId = new Map(
    likeRows.map((row) => [row.activityId, row.count]),
  );
  const likedActivityIds = new Set(viewerLikeRows.map((row) => row.activityId));

  return items.map((item) => ({
    ...item,
    likeCount: countByActivityId.get(item.id) ?? 0,
    isLikedByViewer: likedActivityIds.has(item.id),
  }));
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

  return items.map((item) => {
    let isExplicitBlocked = false;

    if (item.mediaKind === "anime" && item.mediaMalId !== null) {
      isExplicitBlocked = blockedAnimeIds.has(item.mediaMalId);
    }

    if (item.mediaKind === "manga" && item.mediaMalId !== null) {
      isExplicitBlocked = blockedMangaIds.has(item.mediaMalId);
    }

    return {
      ...item,
      isExplicitBlocked,
    };
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

  const itemsWithLikes = await hydrateActivityLikes(items, userId);
  const visibleItems = await filterExplicitActivities(
    itemsWithLikes,
    options?.includeAdultContent ?? false,
  );

  return visibleItems.map(mapActivity);
}

export async function getProfileFeed(
  actorId: string,
  options?: { includeAdultContent?: boolean; viewerId?: string },
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

  const itemsWithLikes = await hydrateActivityLikes(
    items,
    options?.viewerId ?? actorId,
  );
  const visibleItems = await filterExplicitActivities(
    itemsWithLikes,
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

export async function getProfileConnections(
  userId: string,
  type: "followers" | "following",
) {
  const rows =
    type === "followers"
      ? await db
          .select({ userId: userFollows.followerId })
          .from(userFollows)
          .where(eq(userFollows.followingId, userId))
          .orderBy(desc(userFollows.createdAt))
          .limit(48)
      : await db
          .select({ userId: userFollows.followingId })
          .from(userFollows)
          .where(eq(userFollows.followerId, userId))
          .orderBy(desc(userFollows.createdAt))
          .limit(48);

  const userIds = rows.map((row) => row.userId);

  if (!userIds.length) {
    return [];
  }

  const profiles = await db
    .select({
      id: users.id,
      username: users.username,
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(inArray(users.id, userIds));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return userIds
    .map((id) => profileById.get(id))
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));
}

export function isLibraryEntryExplicit(
  entry: { payload: unknown },
  mediaType: "anime" | "manga",
) {
  return isExplicitMediaPayload(entry.payload, mediaType);
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
      favoriteMalId: favoriteManga.malId,
    })
    .from(userMangaList)
    .leftJoin(mangaCache, eq(mangaCache.malId, userMangaList.malId))
    .leftJoin(
      favoriteManga,
      and(eq(favoriteManga.userId, userId), eq(favoriteManga.malId, userMangaList.malId)),
    )
    .where(eq(userMangaList.userId, userId))
    .orderBy(desc(userMangaList.updatedAt));
}

export async function getProfileFavoriteAnime(
  userId: string,
  limit = 9,
  options?: { includeAdultContent?: boolean },
) {
  void options;

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

  return favorites;
}

export async function getProfileFavoriteManga(
  userId: string,
  limit = 9,
  options?: { includeAdultContent?: boolean },
) {
  void options;

  const favorites = await db
    .select({
      id: favoriteManga.id,
      malId: favoriteManga.malId,
      title: mangaCache.title,
      imageUrl: mangaCache.imageUrl,
      position: favoriteManga.position,
      payload: mangaCache.payload,
    })
    .from(favoriteManga)
    .leftJoin(mangaCache, eq(mangaCache.malId, favoriteManga.malId))
    .where(eq(favoriteManga.userId, userId))
    .orderBy(asc(favoriteManga.position), asc(favoriteManga.createdAt))
    .limit(limit);

  return favorites;
}

export async function getProfileFavoriteCharacters(userId: string, limit = 9) {
  const favorites = await db
    .select({
      id: favoriteCharacters.id,
      malId: favoriteCharacters.malId,
      title: characterCache.name,
      imageUrl: characterCache.imageUrl,
      position: favoriteCharacters.position,
      payload: characterCache.payload,
    })
    .from(favoriteCharacters)
    .leftJoin(characterCache, eq(characterCache.malId, favoriteCharacters.malId))
    .where(eq(favoriteCharacters.userId, userId))
    .orderBy(asc(favoriteCharacters.position), asc(favoriteCharacters.createdAt))
    .limit(limit);

  return favorites;
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
