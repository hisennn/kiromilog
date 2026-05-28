"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db, sql } from "@/lib/db";
import { favoriteCharacters } from "@/lib/db/schema";
import { cacheCharacter } from "@/lib/media-cache";
import {
  consumeRateLimit,
  getClientIpFromCurrentRequest,
} from "@/lib/rate-limit";
import { ensureViewerProfile } from "@/lib/viewer-profile";

const FAVORITE_LIMIT = 9;

async function canMutateCharacterFavorite(userId: string, action = "favorite") {
  const ip = await getClientIpFromCurrentRequest();
  const rateLimit = consumeRateLimit({
    key: `character:${action}:${ip}:${userId}`,
    limit: 60,
    windowMs: 60 * 1000,
  });

  return rateLimit.allowed;
}

async function reorderFavoriteCharacterPositions(userId: string, ids: string[]) {
  await sql.transaction((tx) => [
    ...ids.map((id, index) =>
      tx.query(
        "UPDATE favorite_characters SET position = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
        [-(index + 1), id, userId],
      ),
    ),
    ...ids.map((id, index) =>
      tx.query(
        "UPDATE favorite_characters SET position = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
        [index + 1, id, userId],
      ),
    ),
  ]);
}

async function normalizeFavoriteCharacterPositions(userId: string) {
  const rows = await db
    .select({
      id: favoriteCharacters.id,
      position: favoriteCharacters.position,
    })
    .from(favoriteCharacters)
    .where(eq(favoriteCharacters.userId, userId))
    .orderBy(asc(favoriteCharacters.position), asc(favoriteCharacters.createdAt));

  for (const [index, row] of rows.entries()) {
    const nextPosition = index + 1;

    if (row.position !== nextPosition) {
      await db
        .update(favoriteCharacters)
        .set({
          position: nextPosition,
          updatedAt: new Date(),
        })
        .where(eq(favoriteCharacters.id, row.id));
    }
  }
}

export async function toggleFavoriteCharacterAction(
  formData: FormData,
): Promise<{ ok: true; favorited: boolean } | { ok: false; reason: "limit" | "invalid" }> {
  const profile = await ensureViewerProfile({ allowCookieMutation: true });

  if (!profile) {
    redirect("/auth/sign-in");
  }

  if (!(await canMutateCharacterFavorite(profile.id))) {
    return { ok: false, reason: "invalid" };
  }

  const malId = Number(formData.get("malId"));

  if (!Number.isInteger(malId) || malId < 1) {
    return { ok: false, reason: "invalid" };
  }

  await cacheCharacter(malId);

  const [existing] = await db
    .select({ id: favoriteCharacters.id })
    .from(favoriteCharacters)
    .where(and(eq(favoriteCharacters.userId, profile.id), eq(favoriteCharacters.malId, malId)))
    .limit(1);

  if (existing) {
    await db.delete(favoriteCharacters).where(eq(favoriteCharacters.id, existing.id));
    await normalizeFavoriteCharacterPositions(profile.id);
    revalidatePath(`/characters/${malId}`);
    revalidatePath(`/u/${profile.username}`);
    return { ok: true, favorited: false };
  }

  const currentFavorites = await db
    .select({ id: favoriteCharacters.id })
    .from(favoriteCharacters)
    .where(eq(favoriteCharacters.userId, profile.id))
    .orderBy(asc(favoriteCharacters.position), asc(favoriteCharacters.createdAt));

  if (currentFavorites.length >= FAVORITE_LIMIT) {
    return { ok: false, reason: "limit" };
  }

  await db.insert(favoriteCharacters).values({
    userId: profile.id,
    malId,
    position: currentFavorites.length + 1,
    updatedAt: new Date(),
  });

  revalidatePath(`/characters/${malId}`);
  revalidatePath(`/u/${profile.username}`);

  return { ok: true, favorited: true };
}

export async function saveFavoriteCharacterOrderAction(ids: string[]) {
  const profile = await ensureViewerProfile({ allowCookieMutation: true });

  if (!profile) {
    redirect("/auth/sign-in");
  }

  if (!ids.length || ids.length > FAVORITE_LIMIT || new Set(ids).size !== ids.length) {
    return false;
  }

  if (!(await canMutateCharacterFavorite(profile.id, "reorder"))) {
    return false;
  }

  const rows = await db
    .select({ id: favoriteCharacters.id })
    .from(favoriteCharacters)
    .where(eq(favoriteCharacters.userId, profile.id));

  const existingIds = new Set(rows.map((row) => row.id));

  if (rows.length !== ids.length || ids.some((id) => !existingIds.has(id))) {
    return false;
  }

  await reorderFavoriteCharacterPositions(profile.id, ids);
  revalidatePath(`/u/${profile.username}`);

  return true;
}
