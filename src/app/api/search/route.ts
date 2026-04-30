import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { favoriteAnime, userAnimeList, userMangaList } from "@/lib/db/schema";
import { searchMedia } from "@/lib/jikan/client";
import { getViewerProfile } from "@/lib/viewer-profile";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ anime: [], manga: [] });
  }

  try {
    const viewer = await getViewerProfile();
    const includeAdultContent = viewer?.showAdultContent ?? false;
    const anime = await searchMedia(query, "anime", { includeAdultContent });
    await new Promise((resolve) => setTimeout(resolve, 350));
    const manga = await searchMedia(query, "manga", { includeAdultContent });

    if (!viewer) {
      return NextResponse.json({ anime, manga });
    }

    const animeIds = anime.map((item) => item.malId);
    const mangaIds = manga.map((item) => item.malId);

    const [animeEntries, mangaEntries, favoriteAnimeEntries] = await Promise.all([
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
    ]);

    const animeEntryMap = new Map(animeEntries.map((entry) => [entry.malId, entry]));
    const mangaEntryMap = new Map(mangaEntries.map((entry) => [entry.malId, entry]));
    const favoriteAnimeIds = new Set(favoriteAnimeEntries.map((entry) => entry.malId));

    return NextResponse.json({
      anime: anime.map((item) => ({
        ...item,
        libraryEntry: animeEntryMap.get(item.malId) ?? null,
        isFavorite: favoriteAnimeIds.has(item.malId),
      })),
      manga: manga.map((item) => ({
        ...item,
        libraryEntry: mangaEntryMap.get(item.malId) ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ anime: [], manga: [] }, { status: 502 });
  }
}
