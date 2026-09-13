ALTER TABLE "anime_cache" ADD COLUMN "is_explicit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "manga_cache" ADD COLUMN "is_explicit" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE anime_cache SET is_explicit =
  (CASE WHEN jsonb_typeof(payload->'explicit_genres') = 'array' THEN jsonb_array_length(payload->'explicit_genres') > 0 ELSE false END)
  OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(payload->'genres') = 'array' THEN payload->'genres' ELSE '[]'::jsonb END) genre WHERE lower(btrim(genre->>'name')) = 'hentai')
  OR lower(btrim(coalesce(payload->>'rating', ''))) LIKE 'rx%';

--> statement-breakpoint
UPDATE manga_cache SET is_explicit =
  (CASE WHEN jsonb_typeof(payload->'explicit_genres') = 'array' THEN jsonb_array_length(payload->'explicit_genres') > 0 ELSE false END)
  OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(payload->'genres') = 'array' THEN payload->'genres' ELSE '[]'::jsonb END) genre WHERE lower(btrim(genre->>'name')) = 'hentai');
