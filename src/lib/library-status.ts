export const animeStatusValues = [
  "watching",
  "completed",
  "rewatching",
  "paused",
  "dropped",
  "plan_to_watch",
] as const;

export const mangaStatusValues = [
  "reading",
  "completed",
  "rereading",
  "paused",
  "dropped",
  "plan_to_read",
] as const;

export type AnimeStatus = (typeof animeStatusValues)[number];
export type MangaStatus = (typeof mangaStatusValues)[number];

export const animeStatusOptions: Array<{ value: AnimeStatus; label: string }> = [
  { value: "watching", label: "Watching" },
  { value: "completed", label: "Completed" },
  { value: "rewatching", label: "Rewatching" },
  { value: "paused", label: "Paused" },
  { value: "dropped", label: "Dropped" },
  { value: "plan_to_watch", label: "Plan to watch" },
];

export const mangaStatusOptions: Array<{ value: MangaStatus; label: string }> = [
  { value: "reading", label: "Reading" },
  { value: "completed", label: "Completed" },
  { value: "rereading", label: "Rereading" },
  { value: "paused", label: "Paused" },
  { value: "dropped", label: "Dropped" },
  { value: "plan_to_read", label: "Plan to read" },
];
