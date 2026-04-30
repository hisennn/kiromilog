import "server-only";

type MediaType = "anime" | "manga";

type NamedGenre = {
  name?: string | null;
};

function hasExplicitGenre(entries: unknown) {
  return Array.isArray(entries) && entries.length > 0;
}

function hasHentaiGenre(entries: unknown) {
  if (!Array.isArray(entries)) {
    return false;
  }

  return entries.some((entry) => {
    const name = (entry as NamedGenre)?.name?.trim().toLowerCase();
    return name === "hentai";
  });
}

export function isExplicitMediaPayload(
  payload: unknown,
  mediaType: MediaType,
) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;

  if (hasExplicitGenre(record.explicit_genres) || hasHentaiGenre(record.genres)) {
    return true;
  }

  if (mediaType === "anime") {
    const rating = typeof record.rating === "string" ? record.rating.trim().toLowerCase() : "";
    return rating.startsWith("rx");
  }

  return false;
}
