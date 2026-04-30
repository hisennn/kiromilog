export type ActivityPayload = {
  title?: string;
  imageUrl?: string | null;
};

export type AnimeCachePayload = {
  episodes?: number | null;
  type?: string | null;
};

export type MangaCachePayload = {
  chapters?: number | null;
  volumes?: number | null;
  type?: string | null;
};
