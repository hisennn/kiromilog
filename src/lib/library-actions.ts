"use server";

import { and, asc, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { withTransaction, type Transaction } from "@/lib/db/transaction";
import {
  activities,
  users,
  favoriteAnime,
  favoriteManga,
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

async function createStatusActivity(tx: Transaction, input: {
  actorId: string;
  mediaType: "anime" | "manga";
  malId: number;
  listEntryId: string;
  status: string;
  title: string;
  imageUrl: string | null;
}) {
  await tx.insert(activities).values({
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

async function createOrMergeProgressActivity(tx: Transaction, input: {
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

  const [recent] = await tx
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
    await tx
      .update(activities)
      .set({
        progressTo: input.progressTo,
        status: input.status,
        updatedAt: now,
      })
      .where(eq(activities.id, recent.id));

    return;
  }

  await tx.insert(activities).values({
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
  const rateLimit = await consumeRateLimit({
    key: `library:${action}:${ip}:${userId}`,
    limit: 90,
    windowMs: 60 * 1000,
  });

  return rateLimit.allowed;
}

async function createFavoriteActivity(tx: Transaction, input: {
  actorId: string;
  mediaType: "anime" | "manga";
  malId: number;
  title: string;
  imageUrl: string | null;
}) {
  await tx.insert(activities).values({
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
  tx: Transaction,
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

async function reorderFavoritePositions(
  tx: Transaction,
  userId: string,
  table: typeof favoriteAnime | typeof favoriteManga,
  ids: string[],
) {
  for (const sign of [-1, 1]) {
    for (const [index, id] of ids.entries()) {
      await tx.update(table).set({ position: sign * (index + 1), updatedAt: new Date() })
        .where(and(eq(table.id, id), eq(table.userId, userId)));
    }
  }
}

async function saveFavoriteOrder(
  input: {
    ids: string[];
    table: typeof favoriteAnime | typeof favoriteManga;
    action: string;
  },
) {
  const profile = await ensureViewerProfile({ allowCookieMutation: true });

  if (!profile) {
    redirect("/auth/sign-in");
  }

  if (!z.array(z.uuid()).min(1).max(FAVORITE_LIMIT).safeParse(input.ids).success) {
    return false;
  }

  if (new Set(input.ids).size !== input.ids.length) {
    return false;
  }

  if (!(await canMutateLibrary(profile.id, input.action))) {
    return false;
  }

  const saved = await withTransaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, profile.id)).for("no key update");
    const rows = await tx
      .select({ id: input.table.id })
      .from(input.table)
      .where(eq(input.table.userId, profile.id));

    const existingIds = new Set(rows.map((row) => row.id));

    if (rows.length !== input.ids.length || input.ids.some((id) => !existingIds.has(id))) {
      return false;
    }

    await reorderFavoritePositions(tx, profile.id, input.table, input.ids);
    return true;
  });
  if (!saved) return false;
  revalidatePath(`/u/${profile.username}`);

  return true;
}

export async function saveAnimeEntryAction(formData: FormData) {
  const parsed = updateAnimeEntrySchema.safeParse({
    malId: formData.get("malId"),
    status: formData.get("status"),
    score: formData.has("score") ? formData.get("score") : undefined,
    progressEpisodes: formData.has("progressEpisodes") ? formData.get("progressEpisodes") : undefined,
  });

  if (!parsed.success) {
    return false;
  }

  const profile = await ensureViewerProfile({ allowCookieMutation: true });

  if (!profile) {
    redirect("/auth/sign-in");
  }

  if (!(await canMutateLibrary(profile.id, "save-anime"))) {
    return false;
  }

  const cachedAnime = await cacheMedia(parsed.data.malId, "anime");
  const now = new Date();
  const animePayload = cachedAnime.payload as AnimeCachePayload;
  const animeEpisodeLimit = animePayload.episodes ?? null;
  await withTransaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, profile.id)).for("no key update");
    const [existing] = await tx
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

    const [entry] = await tx
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
      await createOrMergeProgressActivity(tx, {
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
      await createStatusActivity(tx, {
        actorId: profile.id,
        mediaType: "anime",
        malId: parsed.data.malId,
        listEntryId: entry.id,
        status: entry.status,
        title: cachedAnime.title,
        imageUrl: cachedAnime.imageUrl,
      });
    }
  });

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
  const result = await withTransaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, profile.id)).for("no key update");
    let favorited = false;
    let ok = false;
    let reason: "limit" | "invalid" = "invalid";
    const [existing] = await tx
      .select({
        id: favoriteAnime.id,
      })
      .from(favoriteAnime)
      .where(and(eq(favoriteAnime.userId, profile.id), eq(favoriteAnime.malId, malId)))
      .limit(1);

    if (existing) {
      await tx.delete(favoriteAnime).where(eq(favoriteAnime.id, existing.id));
      await normalizeFavoritePositions(tx, profile.id, favoriteAnime);
      ok = true;
      favorited = false;
    } else {
      const currentFavorites = await tx
        .select({
          id: favoriteAnime.id,
        })
        .from(favoriteAnime)
        .where(eq(favoriteAnime.userId, profile.id))
        .orderBy(asc(favoriteAnime.position), asc(favoriteAnime.createdAt));

      if (currentFavorites.length >= FAVORITE_LIMIT) {
        reason = "limit";
      } else {
        await tx.insert(favoriteAnime).values({
          userId: profile.id,
          malId,
          position: currentFavorites.length + 1,
          updatedAt: new Date(),
        });

        ok = true;
        favorited = true;
      }
    }

    if (ok && favorited) {
      await createFavoriteActivity(tx, {
        actorId: profile.id,
        mediaType: "anime",
        malId,
        title: cachedAnime.title,
        imageUrl: cachedAnime.imageUrl,
      });
    }

    return ok ? { ok: true as const, favorited } : { ok: false as const, reason };
  });
  if (result.ok) invalidateLibraryViews(profile.username, "anime", malId);
  return result;
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
  const result = await withTransaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, profile.id)).for("no key update");
    let favorited = false;
    let ok = false;
    let reason: "limit" | "invalid" = "invalid";
    const [existing] = await tx
      .select({
        id: favoriteManga.id,
      })
      .from(favoriteManga)
      .where(and(eq(favoriteManga.userId, profile.id), eq(favoriteManga.malId, malId)))
      .limit(1);

    if (existing) {
      await tx.delete(favoriteManga).where(eq(favoriteManga.id, existing.id));
      await normalizeFavoritePositions(tx, profile.id, favoriteManga);
      ok = true;
      favorited = false;
    } else {
      const currentFavorites = await tx
        .select({
          id: favoriteManga.id,
        })
        .from(favoriteManga)
        .where(eq(favoriteManga.userId, profile.id))
        .orderBy(asc(favoriteManga.position), asc(favoriteManga.createdAt));

      if (currentFavorites.length >= FAVORITE_LIMIT) {
        reason = "limit";
      } else {
        await tx.insert(favoriteManga).values({
          userId: profile.id,
          malId,
          position: currentFavorites.length + 1,
          updatedAt: new Date(),
        });

        ok = true;
        favorited = true;
      }
    }

    if (ok && favorited) {
      await createFavoriteActivity(tx, {
        actorId: profile.id,
        mediaType: "manga",
        malId,
        title: cachedManga.title,
        imageUrl: cachedManga.imageUrl,
      });
    }

    return ok ? { ok: true as const, favorited } : { ok: false as const, reason };
  });
  if (result.ok) invalidateLibraryViews(profile.username, "manga", malId);
  return result;
}

export async function saveFavoriteAnimeOrderAction(ids: string[]) {
  return saveFavoriteOrder({
    ids,
    table: favoriteAnime,
    action: "reorder-favorite-anime",
  });
}

export async function saveFavoriteMangaOrderAction(ids: string[]) {
  return saveFavoriteOrder({
    ids,
    table: favoriteManga,
    action: "reorder-favorite-manga",
  });
}

export async function saveMangaEntryAction(formData: FormData) {
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

  const profile = await ensureViewerProfile({ allowCookieMutation: true });

  if (!profile) {
    redirect("/auth/sign-in");
  }

  if (!(await canMutateLibrary(profile.id, "save-manga"))) {
    return false;
  }

  const cachedManga = await cacheMedia(parsed.data.malId, "manga");
  const now = new Date();
  const mangaPayload = cachedManga.payload as MangaCachePayload;
  const mangaChapterLimit = mangaPayload.chapters ?? null;
  const mangaVolumeLimit = mangaPayload.volumes ?? null;
  await withTransaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, profile.id)).for("no key update");
    const [existing] = await tx
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

    const [entry] = await tx
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
      await createOrMergeProgressActivity(tx, {
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
      await createStatusActivity(tx, {
        actorId: profile.id,
        mediaType: "manga",
        malId: parsed.data.malId,
        listEntryId: entry.id,
        status: entry.status,
        title: cachedManga.title,
        imageUrl: cachedManga.imageUrl,
      });
    }
  });

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

  await withTransaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, profile.id)).for("no key update");
    if (mediaType === "anime") {
      await tx
        .delete(userAnimeList)
        .where(and(eq(userAnimeList.userId, profile.id), eq(userAnimeList.malId, malId)));
    } else {
      await tx
        .delete(userMangaList)
        .where(and(eq(userMangaList.userId, profile.id), eq(userMangaList.malId, malId)));
    }

    await tx
      .delete(activities)
      .where(
        and(
          eq(activities.actorId, profile.id),
          eq(activities.mediaKind, mediaType),
          eq(activities.mediaMalId, malId),
        ),
      );
  });

  invalidateLibraryViews(profile.username, mediaType, malId);
}


