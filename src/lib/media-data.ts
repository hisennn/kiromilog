import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { characterCache, favoriteAnime, favoriteCharacters, favoriteManga, userAnimeList, userMangaList } from "@/lib/db/schema";
import { cacheCharacter, cacheMedia } from "@/lib/media-cache";

export type MediaDetailType = "anime" | "manga";

export async function getMediaDetail(malId: number, mediaType: MediaDetailType) {
  return cacheMedia(malId, mediaType);
}

export async function getCharacterDetail(malId: number) {
  return cacheCharacter(malId);
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

export async function getViewerCharacterFavorite(userId: string, malId: number) {
  const [entry] = await db
    .select({ id: favoriteCharacters.id })
    .from(favoriteCharacters)
    .where(and(eq(favoriteCharacters.userId, userId), eq(favoriteCharacters.malId, malId)))
    .limit(1);

  return entry !== undefined;
}

export async function getViewerMangaFavorite(userId: string, malId: number) {
  const [entry] = await db
    .select({ id: favoriteManga.id })
    .from(favoriteManga)
    .where(and(eq(favoriteManga.userId, userId), eq(favoriteManga.malId, malId)))
    .limit(1);

  return entry !== undefined;
}

export async function getCachedCharacter(malId: number) {
  const [entry] = await db
    .select()
    .from(characterCache)
    .where(eq(characterCache.malId, malId))
    .limit(1);

  return entry ?? null;
}

export async function getViewerMangaEntry(userId: string, malId: number) {
  const [entry] = await db
    .select()
    .from(userMangaList)
    .where(and(eq(userMangaList.userId, userId), eq(userMangaList.malId, malId)))
    .limit(1);

  return entry ?? null;
}
