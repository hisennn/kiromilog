import "server-only";

const JIKAN_BASE_URL = "https://api.jikan.moe/v4";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type SearchMediaType = "anime" | "manga";
type SearchCharacterType = "characters";

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
  pagination?: JikanPagination;
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

type JikanPagination = {
  last_visible_page?: number;
  has_next_page?: boolean;
  current_page?: number;
  items?: {
    count?: number;
    total?: number;
    per_page?: number;
  };
};

type JikanCharacterItem = {
  mal_id: number;
  name: string;
  name_kanji?: string | null;
  nicknames?: string[];
  about?: string | null;
  images?: JikanImageSet;
  favorites?: number | null;
};

type JikanCharacterSearchResponse = {
  data: JikanCharacterItem[];
  pagination?: JikanPagination;
};

type JikanCharacterFullResponse = {
  data: JikanCharacterItem & {
    anime?: Array<{ anime?: { mal_id: number; title: string; images?: JikanImageSet } }>;
    manga?: Array<{ manga?: { mal_id: number; title: string; images?: JikanImageSet } }>;
    voices?: Array<{
      language?: string | null;
      person?: {
        mal_id: number;
        name: string;
        images?: JikanImageSet;
      };
    }>;
  };
};

type JikanMediaCharacterResponse = {
  data: Array<{
    role?: string | null;
    favorites?: number | null;
    character: {
      mal_id: number;
      name: string;
      images?: JikanImageSet;
    };
  }>;
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
  options?: { includeAdultContent?: boolean; limit?: number; page?: number },
) {
  const result = await searchMediaPage(query, mediaType, options);
  return result.items;
}

export async function searchMediaPage(
  query: string,
  mediaType: SearchMediaType,
  options?: { includeAdultContent?: boolean; limit?: number; page?: number },
) {
  const params = new URLSearchParams({
    q: query,
    limit: String(options?.limit ?? 8),
    page: String(options?.page ?? 1),
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

  return {
    items: dedupeByMalId(mappedResults),
    pagination: normalizePagination(response.pagination, options?.page ?? 1),
  };
}

export async function searchCharacters(
  query: string,
  options?: { limit?: number; page?: number },
) {
  const params = new URLSearchParams({
    q: query,
    limit: String(options?.limit ?? 20),
    page: String(options?.page ?? 1),
    order_by: "favorites",
    sort: "desc",
  });
  const response = await fetchFromJikan<JikanCharacterSearchResponse>(
    `/${"characters" satisfies SearchCharacterType}`,
    params,
  );
  const mappedResults = response.data.map((item) => ({
    malId: item.mal_id,
    name: item.name,
    nameKanji: item.name_kanji ?? null,
    nicknames: item.nicknames ?? [],
    about: item.about ?? null,
    imageUrl: resolveImage(item.images),
    favorites: item.favorites ?? 0,
  }));

  return {
    items: dedupeByMalId(mappedResults),
    pagination: normalizePagination(response.pagination, options?.page ?? 1),
  };
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

export async function fetchFullCharacterEntry(malId: number) {
  const response = await fetchFromJikan<JikanCharacterFullResponse>(`/characters/${malId}/full`);
  const item = response.data;

  return {
    malId: item.mal_id,
    name: item.name,
    nameKanji: item.name_kanji ?? null,
    imageUrl: resolveImage(item.images),
    payload: item,
  };
}

export async function fetchMediaCharacters(malId: number, mediaType: SearchMediaType) {
  const response = await fetchFromJikan<JikanMediaCharacterResponse>(`/${mediaType}/${malId}/characters`);

  return dedupeByMalId(
    response.data
      .map((item) => ({
        malId: item.character.mal_id,
        name: item.character.name,
        imageUrl: resolveImage(item.character.images),
        role: item.role ?? null,
        favorites: item.favorites ?? 0,
      }))
      .sort((left, right) => (right.favorites ?? 0) - (left.favorites ?? 0)),
  );
}

function normalizePagination(pagination: JikanPagination | undefined, fallbackPage: number) {
  return {
    currentPage: pagination?.current_page ?? fallbackPage,
    lastPage: Math.max(1, pagination?.last_visible_page ?? fallbackPage),
    hasNextPage: pagination?.has_next_page ?? false,
    total: pagination?.items?.total ?? null,
    count: pagination?.items?.count ?? null,
    perPage: pagination?.items?.per_page ?? null,
  };
}

export function isCacheFresh(cachedAt: Date) {
  return Date.now() - cachedAt.getTime() < CACHE_TTL_MS;
}
