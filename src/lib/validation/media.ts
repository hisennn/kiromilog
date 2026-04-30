import { z } from "zod";

import { animeStatusValues, mangaStatusValues } from "@/lib/library-status";
const nullableScore = z
  .union([z.literal(""), z.coerce.number().int().min(1).max(12)])
  .transform((value) => (value === "" ? null : value));

export const mediaSearchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  type: z.enum(["anime", "manga"]),
});

export const navbarSearchSchema = z.object({
  q: z.string().trim().min(1).max(100),
});

export const updateAnimeEntrySchema = z.object({
  malId: z.coerce.number().int().positive(),
  status: z.enum(animeStatusValues),
  score: nullableScore.optional(),
  progressEpisodes: z.coerce.number().int().min(0).optional(),
});

export const updateMangaEntrySchema = z.object({
  malId: z.coerce.number().int().positive(),
  status: z.enum(mangaStatusValues),
  score: nullableScore.optional(),
  progressChapters: z.coerce.number().int().min(0).optional(),
  progressVolumes: z.coerce.number().int().min(0).optional(),
});



