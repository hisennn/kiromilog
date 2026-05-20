import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { animeCache, characterCache, mangaCache } from "@/lib/db/schema";
import {
  fetchFullCharacterEntry,
  fetchFullMediaEntry,
  isCacheFresh,
} from "@/lib/jikan/client";

export type CacheMediaType = "anime" | "manga";

export async function cacheMedia(malId: number, mediaType: CacheMediaType) {
  const table = mediaType === "anime" ? animeCache : mangaCache;
  const existing = await db
    .select()
    .from(table)
    .where(eq(table.malId, malId))
    .limit(1);

  if (existing[0] && isCacheFresh(existing[0].cachedAt)) {
    return existing[0];
  }

  const fresh = await fetchFullMediaEntry(malId, mediaType);
  const [saved] = await db
    .insert(table)
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
      target: table.malId,
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

export async function cacheCharacter(malId: number) {
  const existing = await db
    .select()
    .from(characterCache)
    .where(eq(characterCache.malId, malId))
    .limit(1);

  if (existing[0] && isCacheFresh(existing[0].cachedAt)) {
    return existing[0];
  }

  const fresh = await fetchFullCharacterEntry(malId);
  const [saved] = await db
    .insert(characterCache)
    .values({
      malId: fresh.malId,
      name: fresh.name,
      imageUrl: fresh.imageUrl,
      payload: fresh.payload,
      cachedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: characterCache.malId,
      set: {
        name: fresh.name,
        imageUrl: fresh.imageUrl,
        payload: fresh.payload,
        cachedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return saved;
}
