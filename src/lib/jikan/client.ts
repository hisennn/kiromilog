import "server-only";

const JIKAN_BASE_URL = "https://api.jikan.moe/v4";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type SearchMediaType = "anime" | "manga";

type JikanImageSet = {
  jpg?: {
    image_url?: string;
    large_image_url?: string;
  };
  webp?: {
    image_url?: string;
    large_image_url?: string;
  };
};

type JikanSearchItem = {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  synopsis: string | null;
  images: JikanImageSet;
  score: number | null;
  status: string | null;
  episodes?: number | null;
  chapters?: number | null;
  year?: number | null;
};

type JikanSearchResponse = {
  data: JikanSearchItem[];
};

type JikanFullResponse = {
  data: Record<string, unknown> & {
    mal_id: number;
    title: string;
    title_english?: string | null;
    title_japanese?: string | null;
    synopsis?: string | null;
    images?: JikanImageSet;
  };
};

function resolveImage(images?: JikanImageSet) {
  return (
    images?.webp?.large_image_url ||
    images?.webp?.image_url ||
    images?.jpg?.large_image_url ||
    images?.jpg?.image_url ||
    null
  );
}

function dedupeByMalId<T extends { malId: number }>(items: T[]) {
  const seen = new Set<number>();

  return items.filter((item) => {
    if (seen.has(item.malId)) {
      return false;
    }

    seen.add(item.malId);
    return true;
  });
}

async function fetchFromJikan<T>(path: string, searchParams?: URLSearchParams) {
  const query = searchParams?.toString();
  const url = `${JIKAN_BASE_URL}${path}${query ? `?${query}` : ""}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: 60,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Jikan request failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

export async function searchMedia(
  query: string,
  mediaType: SearchMediaType,
  options?: { includeAdultContent?: boolean },
) {
  const params = new URLSearchParams({
    q: query,
    limit: "8",
  });

  if (!options?.includeAdultContent) {
    params.set("sfw", "true");
  }

  const response = await fetchFromJikan<JikanSearchResponse>(`/${mediaType}`, params);
  const mappedResults = response.data.map((item) => ({
    malId: item.mal_id,
    mediaType,
    title: item.title,
    titleEnglish: item.title_english,
    titleJapanese: item.title_japanese,
    synopsis: item.synopsis,
    imageUrl: resolveImage(item.images),
    score: item.score,
    status: item.status,
    progressTotal: mediaType === "anime" ? item.episodes ?? null : item.chapters ?? null,
    year: item.year ?? null,
  }));

  return dedupeByMalId(mappedResults);
}

export async function fetchFullMediaEntry(malId: number, mediaType: SearchMediaType) {
  const response = await fetchFromJikan<JikanFullResponse>(`/${mediaType}/${malId}/full`);
  const item = response.data;

  return {
    malId: item.mal_id,
    title: item.title,
    titleEnglish: item.title_english ?? null,
    titleJapanese: item.title_japanese ?? null,
    synopsis: item.synopsis ?? null,
    imageUrl: resolveImage(item.images),
    payload: item,
  };
}

export function isCacheFresh(cachedAt: Date) {
  return Date.now() - cachedAt.getTime() < CACHE_TTL_MS;
}
