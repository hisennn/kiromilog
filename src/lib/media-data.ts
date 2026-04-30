import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { animeCache, favoriteAnime, mangaCache, userAnimeList, userMangaList } from "@/lib/db/schema";
import { fetchFullMediaEntry, isCacheFresh } from "@/lib/jikan/client";

export type MediaDetailType = "anime" | "manga";

async function getFreshAnime(malId: number) {
  const existing = await db
    .select()
    .from(animeCache)
    .where(eq(animeCache.malId, malId))
    .limit(1);

  if (existing[0] && isCacheFresh(existing[0].cachedAt)) {
    return existing[0];
  }

  const fresh = await fetchFullMediaEntry(malId, "anime");
  const [saved] = await db
    .insert(animeCache)
    .values({
      malId: fresh.malId,
      title: fresh.title,
      titleEnglish: fresh.titleEnglish,
      titleJapanese: fresh.titleJapanese,
      imageUrl: fresh.imageUrl,
      synopsis: fresh.synopsis,
      payload: fresh.payload,
      cachedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: animeCache.malId,
      set: {
        title: fresh.title,
        titleEnglish: fresh.titleEnglish,
        titleJapanese: fresh.titleJapanese,
        imageUrl: fresh.imageUrl,
        synopsis: fresh.synopsis,
        payload: fresh.payload,
        cachedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return saved;
}

async function getFreshManga(malId: number) {
  const existing = await db
    .select()
    .from(mangaCache)
    .where(eq(mangaCache.malId, malId))
    .limit(1);

  if (existing[0] && isCacheFresh(existing[0].cachedAt)) {
    return existing[0];
  }

  const fresh = await fetchFullMediaEntry(malId, "manga");
  const [saved] = await db
    .insert(mangaCache)
    .values({
      malId: fresh.malId,
      title: fresh.title,
      titleEnglish: fresh.titleEnglish,
      titleJapanese: fresh.titleJapanese,
      imageUrl: fresh.imageUrl,
      synopsis: fresh.synopsis,
      payload: fresh.payload,
      cachedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: mangaCache.malId,
      set: {
        title: fresh.title,
        titleEnglish: fresh.titleEnglish,
        titleJapanese: fresh.titleJapanese,
        imageUrl: fresh.imageUrl,
        synopsis: fresh.synopsis,
        payload: fresh.payload,
        cachedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return saved;
}

export async function getMediaDetail(malId: number, mediaType: MediaDetailType) {
  if (mediaType === "anime") {
    return getFreshAnime(malId);
  }

  return getFreshManga(malId);
}

export async function getViewerAnimeEntry(userId: string, malId: number) {
  const [entry] = await db
    .select()
    .from(userAnimeList)
    .where(and(eq(userAnimeList.userId, userId), eq(userAnimeList.malId, malId)))
    .limit(1);

  return entry ?? null;
}

export async function getViewerAnimeFavorite(userId: string, malId: number) {
  const [entry] = await db
    .select({ id: favoriteAnime.id })
    .from(favoriteAnime)
    .where(and(eq(favoriteAnime.userId, userId), eq(favoriteAnime.malId, malId)))
    .limit(1);

  return entry !== undefined;
}

export async function getViewerMangaEntry(userId: string, malId: number) {
  const [entry] = await db
    .select()
    .from(userMangaList)
    .where(and(eq(userMangaList.userId, userId), eq(userMangaList.malId, malId)))
    .limit(1);

  return entry ?? null;
}
