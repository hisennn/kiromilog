"use server";

import { and, asc, desc, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import {
  activities,
  animeCache,
  favoriteAnime,
  favoriteManga,
  mangaCache,
  userAnimeList,
  userMangaList,
} from "@/lib/db/schema";
import { cacheMedia } from "@/lib/media-cache";
import {
  consumeRateLimit,
  getClientIpFromCurrentRequest,
} from "@/lib/rate-limit";
import {
  updateAnimeEntrySchema,
  updateMangaEntrySchema,
} from "@/lib/validation/media";
import { AnimeCachePayload, MangaCachePayload } from "@/lib/media-payload";
import { ensureViewerProfile } from "@/lib/viewer-profile";

const FAVORITE_LIMIT = 9;

async function createStatusActivity(input: {
  actorId: string;
  mediaType: "anime" | "manga";
  malId: number;
  listEntryId: string;
  status: string;
  title: string;
  imageUrl: string | null;
}) {
  await db.insert(activities).values({
    actorId: input.actorId,
    kind: input.mediaType === "anime" ? "anime_status" : "manga_status",
    mediaKind: input.mediaType,
    mediaMalId: input.malId,
    listEntryId: input.listEntryId,
    status: input.status,
    payload: {
      title: input.title,
      imageUrl: input.imageUrl,
    },
    updatedAt: new Date(),
  });
}

async function createOrMergeProgressActivity(input: {
  actorId: string;
  mediaType: "anime" | "manga";
  malId: number;
  listEntryId: string;
  status: string;
  title: string;
  imageUrl: string | null;
  progressFrom: number;
  progressTo: number;
}) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000);
  const kind = input.mediaType === "anime" ? "anime_progress" : "manga_progress";

  const [recent] = await db
    .select({
      id: activities.id,
    })
    .from(activities)
    .where(
      and(
        eq(activities.actorId, input.actorId),
        eq(activities.kind, kind),
        eq(activities.mediaKind, input.mediaType),
        eq(activities.mediaMalId, input.malId),
        gte(activities.createdAt, cutoff),
      ),
    )
    .orderBy(desc(activities.createdAt))
    .limit(1);

  if (recent) {
    await db
      .update(activities)
      .set({
        progressTo: input.progressTo,
        status: input.status,
        updatedAt: now,
      })
      .where(eq(activities.id, recent.id));

    return;
  }

  await db.insert(activities).values({
    actorId: input.actorId,
    kind,
    mediaKind: input.mediaType,
    mediaMalId: input.malId,
    listEntryId: input.listEntryId,
    status: input.status,
    progressFrom: input.progressFrom,
    progressTo: input.progressTo,
    payload: {
      title: input.title,
      imageUrl: input.imageUrl,
    },
    updatedAt: now,
  });
}

function invalidateLibraryViews(username: string, mediaType: "anime" | "manga", malId: number) {
  revalidatePath("/home");
  revalidatePath(`/u/${username}`);
  revalidatePath(`/${mediaType}/${malId}`);
}

async function canMutateLibrary(userId: string, action: string) {
  const ip = await getClientIpFromCurrentRequest();
  const rateLimit = consumeRateLimit({
    key: `library:${action}:${ip}:${userId}`,
    limit: 90,
    windowMs: 60 * 1000,
  });

  return rateLimit.allowed;
}

async function createFavoriteActivity(input: {
  actorId: string;
  mediaType: "anime" | "manga";
  malId: number;
  title: string;
  imageUrl: string | null;
}) {
  await db.insert(activities).values({
    actorId: input.actorId,
    kind: "favorite_added",
    mediaKind: input.mediaType,
    mediaMalId: input.malId,
    payload: {
      title: input.title,
      imageUrl: input.imageUrl,
    },
    updatedAt: new Date(),
  });
}

async function normalizeFavoritePositions(
  tx: typeof db,
  userId: string,
  table: typeof favoriteAnime | typeof favoriteManga,
) {
  const rows = await tx
    .select({
      id: table.id,
      position: table.position,
    })
    .from(table)
    .where(eq(table.userId, userId))
    .orderBy(asc(table.position), asc(table.createdAt));

  for (const [index, row] of rows.entries()) {
    const nextPosition = index + 1;

    if (row.position !== nextPosition) {
      await tx
        .update(table)
        .set({
          position: nextPosition,
          updatedAt: new Date(),
        })
        .where(eq(table.id, row.id));
    }
  }
}

export async function saveAnimeEntryAction(formData: FormData) {
  const profile = await ensureViewerProfile({ allowCookieMutation: true });

  if (!profile) {
    redirect("/auth/sign-in");
  }

  if (!(await canMutateLibrary(profile.id, "save-anime"))) {
    return false;
  }

  const parsed = updateAnimeEntrySchema.safeParse({
    malId: formData.get("malId"),
    status: formData.get("status"),
    score: formData.has("score") ? formData.get("score") : undefined,
    progressEpisodes: formData.has("progressEpisodes") ? formData.get("progressEpisodes") : undefined,
  });

  if (!parsed.success) {
    return false;
  }

  const now = new Date();
  const cachedAnime = await cacheMedia(parsed.data.malId, "anime");
  const animePayload = cachedAnime.payload as AnimeCachePayload;
  const animeEpisodeLimit = animePayload.episodes ?? null;
  const [existing] = await db
    .select()
    .from(userAnimeList)
    .where(and(eq(userAnimeList.userId, profile.id), eq(userAnimeList.malId, parsed.data.malId)))
    .limit(1);

  const requestedEpisodes = parsed.data.progressEpisodes ?? existing?.progressEpisodes ?? 0;
  const progressEpisodes =
    parsed.data.status === "completed" && animeEpisodeLimit !== null
      ? animeEpisodeLimit
      : Math.min(requestedEpisodes, animeEpisodeLimit ?? requestedEpisodes);
  const animeStatus =
    parsed.data.status === "plan_to_watch" && progressEpisodes > 0
      ? "watching"
      : parsed.data.status;
  const score = parsed.data.score !== undefined ? parsed.data.score : (existing?.score ?? null);

  const [entry] = await db
    .insert(userAnimeList)
    .values({
      userId: profile.id,
      malId: parsed.data.malId,
      status: animeStatus,
      score: score,
      progressEpisodes: progressEpisodes,
      startedAt:
        animeStatus === "watching" || animeStatus === "rewatching"
          ? existing?.startedAt ?? now
          : existing?.startedAt ?? null,
      completedAt: animeStatus === "completed" ? existing?.completedAt ?? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userAnimeList.userId, userAnimeList.malId],
      set: {
        status: animeStatus,
        score: score,
        progressEpisodes: progressEpisodes,
        startedAt:
          animeStatus === "watching" || animeStatus === "rewatching"
            ? existing?.startedAt ?? now
            : existing?.startedAt ?? null,
        completedAt: animeStatus === "completed" ? existing?.completedAt ?? now : null,
        updatedAt: now,
      },
    })
    .returning({
      id: userAnimeList.id,
      status: userAnimeList.status,
      progressEpisodes: userAnimeList.progressEpisodes,
    });

  if (entry && progressEpisodes > (existing?.progressEpisodes ?? 0)) {
    await createOrMergeProgressActivity({
      actorId: profile.id,
      mediaType: "anime",
      malId: parsed.data.malId,
      listEntryId: entry.id,
      status: entry.status,
      title: cachedAnime.title,
      imageUrl: cachedAnime.imageUrl,
      progressFrom: existing?.progressEpisodes ?? 0,
      progressTo: progressEpisodes,
    });
  }

  if (entry && animeStatus !== existing?.status) {
    await createStatusActivity({
      actorId: profile.id,
      mediaType: "anime",
      malId: parsed.data.malId,
      listEntryId: entry.id,
      status: entry.status,
      title: cachedAnime.title,
      imageUrl: cachedAnime.imageUrl,
    });
  }

  invalidateLibraryViews(profile.username, "anime", parsed.data.malId);

  return true;
}

export async function toggleFavoriteAnimeAction(
  formData: FormData,
): Promise<{ ok: true; favorited: boolean } | { ok: false; reason: "limit" | "invalid" }> {
  const profile = await ensureViewerProfile({ allowCookieMutation: true });

  if (!profile) {
    redirect("/auth/sign-in");
  }

  if (!(await canMutateLibrary(profile.id, "favorite-anime"))) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const malId = Number(formData.get("malId"));

  if (!Number.isInteger(malId) || malId < 1) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const cachedAnime = await cacheMedia(malId, "anime");
  let favorited = false;
  let ok = false;
  let reason: "limit" | "invalid" = "invalid";
  const [existing] = await db
    .select({
      id: favoriteAnime.id,
    })
    .from(favoriteAnime)
    .where(and(eq(favoriteAnime.userId, profile.id), eq(favoriteAnime.malId, malId)))
    .limit(1);

  if (existing) {
    await db.delete(favoriteAnime).where(eq(favoriteAnime.id, existing.id));
    await normalizeFavoritePositions(db, profile.id, favoriteAnime);
    ok = true;
    favorited = false;
  } else {
    const currentFavorites = await db
      .select({
        id: favoriteAnime.id,
      })
      .from(favoriteAnime)
      .where(eq(favoriteAnime.userId, profile.id))
      .orderBy(asc(favoriteAnime.position), asc(favoriteAnime.createdAt));

    if (currentFavorites.length >= FAVORITE_LIMIT) {
      reason = "limit";
    } else {
      await db.insert(favoriteAnime).values({
        userId: profile.id,
        malId,
        position: currentFavorites.length + 1,
        updatedAt: new Date(),
      });

      ok = true;
      favorited = true;
    }
  }

  if (ok) {
    if (favorited) {
      await createFavoriteActivity({
        actorId: profile.id,
        mediaType: "anime",
        malId,
        title: cachedAnime.title,
        imageUrl: cachedAnime.imageUrl,
      });
    }

    invalidateLibraryViews(profile.username, "anime", malId);
  }

  return ok ? { ok: true, favorited } : { ok: false, reason };
}

export async function toggleFavoriteMangaAction(
  formData: FormData,
): Promise<{ ok: true; favorited: boolean } | { ok: false; reason: "limit" | "invalid" }> {
  const profile = await ensureViewerProfile({ allowCookieMutation: true });

  if (!profile) {
    redirect("/auth/sign-in");
  }

  if (!(await canMutateLibrary(profile.id, "favorite-manga"))) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const malId = Number(formData.get("malId"));

  if (!Number.isInteger(malId) || malId < 1) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const cachedManga = await cacheMedia(malId, "manga");
  let favorited = false;
  let ok = false;
  let reason: "limit" | "invalid" = "invalid";
  const [existing] = await db
    .select({
      id: favoriteManga.id,
    })
    .from(favoriteManga)
    .where(and(eq(favoriteManga.userId, profile.id), eq(favoriteManga.malId, malId)))
    .limit(1);

  if (existing) {
    await db.delete(favoriteManga).where(eq(favoriteManga.id, existing.id));
    await normalizeFavoritePositions(db, profile.id, favoriteManga);
    ok = true;
    favorited = false;
  } else {
    const currentFavorites = await db
      .select({
        id: favoriteManga.id,
      })
      .from(favoriteManga)
      .where(eq(favoriteManga.userId, profile.id))
      .orderBy(asc(favoriteManga.position), asc(favoriteManga.createdAt));

    if (currentFavorites.length >= FAVORITE_LIMIT) {
      reason = "limit";
    } else {
      await db.insert(favoriteManga).values({
        userId: profile.id,
        malId,
        position: currentFavorites.length + 1,
        updatedAt: new Date(),
      });

      ok = true;
      favorited = true;
    }
  }

  if (ok) {
    if (favorited) {
      await createFavoriteActivity({
        actorId: profile.id,
        mediaType: "manga",
        malId,
        title: cachedManga.title,
        imageUrl: cachedManga.imageUrl,
      });
    }

    invalidateLibraryViews(profile.username, "manga", malId);
  }

  return ok ? { ok: true, favorited } : { ok: false, reason };
}

export async function saveMangaEntryAction(formData: FormData) {
  const profile = await ensureViewerProfile({ allowCookieMutation: true });

  if (!profile) {
    redirect("/auth/sign-in");
  }

  if (!(await canMutateLibrary(profile.id, "save-manga"))) {
    return false;
  }

  const parsed = updateMangaEntrySchema.safeParse({
    malId: formData.get("malId"),
    status: formData.get("status"),
    score: formData.has("score") ? formData.get("score") : undefined,
    progressChapters: formData.has("progressChapters") ? formData.get("progressChapters") : undefined,
    progressVolumes: formData.has("progressVolumes") ? formData.get("progressVolumes") : undefined,
  });

  if (!parsed.success) {
    return false;
  }

  const now = new Date();
  const cachedManga = await cacheMedia(parsed.data.malId, "manga");
  const mangaPayload = cachedManga.payload as MangaCachePayload;
  const mangaChapterLimit = mangaPayload.chapters ?? null;
  const mangaVolumeLimit = mangaPayload.volumes ?? null;
  const [existing] = await db
    .select()
    .from(userMangaList)
    .where(and(eq(userMangaList.userId, profile.id), eq(userMangaList.malId, parsed.data.malId)))
    .limit(1);

  const requestedChapters = parsed.data.progressChapters ?? existing?.progressChapters ?? 0;
  const requestedVolumes = parsed.data.progressVolumes ?? existing?.progressVolumes ?? 0;
  const progressChapters =
    parsed.data.status === "completed" && mangaChapterLimit !== null
      ? mangaChapterLimit
      : Math.min(requestedChapters, mangaChapterLimit ?? requestedChapters);
  const progressVolumes =
    parsed.data.status === "completed" && mangaVolumeLimit !== null
      ? mangaVolumeLimit
      : Math.min(requestedVolumes, mangaVolumeLimit ?? requestedVolumes);
  const mangaStatus =
    parsed.data.status === "plan_to_read" && (progressChapters > 0 || progressVolumes > 0)
      ? "reading"
      : parsed.data.status;
  const score = parsed.data.score !== undefined ? parsed.data.score : (existing?.score ?? null);

  const [entry] = await db
    .insert(userMangaList)
    .values({
      userId: profile.id,
      malId: parsed.data.malId,
      status: mangaStatus,
      score: score,
      progressChapters: progressChapters,
      progressVolumes: progressVolumes,
      startedAt:
        mangaStatus === "reading" || mangaStatus === "rereading"
          ? existing?.startedAt ?? now
          : existing?.startedAt ?? null,
      completedAt: mangaStatus === "completed" ? existing?.completedAt ?? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userMangaList.userId, userMangaList.malId],
      set: {
        status: mangaStatus,
        score: score,
        progressChapters: progressChapters,
        progressVolumes: progressVolumes,
        startedAt:
          mangaStatus === "reading" || mangaStatus === "rereading"
            ? existing?.startedAt ?? now
            : existing?.startedAt ?? null,
        completedAt: mangaStatus === "completed" ? existing?.completedAt ?? now : null,
        updatedAt: now,
      },
    })
    .returning({
      id: userMangaList.id,
      status: userMangaList.status,
      progressChapters: userMangaList.progressChapters,
    });

  if (entry && progressChapters > (existing?.progressChapters ?? 0)) {
    await createOrMergeProgressActivity({
      actorId: profile.id,
      mediaType: "manga",
      malId: parsed.data.malId,
      listEntryId: entry.id,
      status: entry.status,
      title: cachedManga.title,
      imageUrl: cachedManga.imageUrl,
      progressFrom: existing?.progressChapters ?? 0,
      progressTo: progressChapters,
    });
  }

  if (entry && mangaStatus !== existing?.status) {
    await createStatusActivity({
      actorId: profile.id,
      mediaType: "manga",
      malId: parsed.data.malId,
      listEntryId: entry.id,
      status: entry.status,
      title: cachedManga.title,
      imageUrl: cachedManga.imageUrl,
    });
  }

  invalidateLibraryViews(profile.username, "manga", parsed.data.malId);

  return true;
}

export async function deleteLibraryEntryAction(formData: FormData) {
  const profile = await ensureViewerProfile({ allowCookieMutation: true });

  if (!profile) {
    redirect("/auth/sign-in");
  }

  if (!(await canMutateLibrary(profile.id, "delete-entry"))) {
    return;
  }

  const mediaType = formData.get("mediaType");
  const malId = Number(formData.get("malId"));

  if ((mediaType !== "anime" && mediaType !== "manga") || !Number.isInteger(malId) || malId < 1) {
    return;
  }

  if (mediaType === "anime") {
    await db
      .delete(userAnimeList)
      .where(and(eq(userAnimeList.userId, profile.id), eq(userAnimeList.malId, malId)));
  } else {
    await db
      .delete(userMangaList)
      .where(and(eq(userMangaList.userId, profile.id), eq(userMangaList.malId, malId)));
  }

  await db
    .delete(activities)
    .where(
      and(
        eq(activities.actorId, profile.id),
        eq(activities.mediaKind, mediaType),
        eq(activities.mediaMalId, malId),
      ),
    );

  invalidateLibraryViews(profile.username, mediaType, malId);
}

export async function getRecentLibrary(userId: string) {
  const anime = await db
    .select({
      id: userAnimeList.id,
      mediaType: userAnimeList.status,
      malId: userAnimeList.malId,
      updatedAt: userAnimeList.updatedAt,
      title: animeCache.title,
    })
    .from(userAnimeList)
    .leftJoin(animeCache, eq(animeCache.malId, userAnimeList.malId))
    .where(eq(userAnimeList.userId, userId))
    .orderBy(desc(userAnimeList.updatedAt))
    .limit(4);

  const manga = await db
    .select({
      id: userMangaList.id,
      mediaType: userMangaList.status,
      malId: userMangaList.malId,
      updatedAt: userMangaList.updatedAt,
      title: mangaCache.title,
    })
    .from(userMangaList)
    .leftJoin(mangaCache, eq(mangaCache.malId, userMangaList.malId))
    .where(eq(userMangaList.userId, userId))
    .orderBy(desc(userMangaList.updatedAt))
    .limit(4);

  return [
    ...anime.map((item) => ({ ...item, kind: "anime" as const })),
    ...manga.map((item) => ({ ...item, kind: "manga" as const })),
  ]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 6);
}


