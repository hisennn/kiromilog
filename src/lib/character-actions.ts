"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { withTransaction, type Transaction } from "@/lib/db/transaction";
import { z } from "zod";
import { favoriteCharacters, users } from "@/lib/db/schema";
import { cacheCharacter } from "@/lib/media-cache";
import {
  consumeRateLimit,
  getClientIpFromCurrentRequest,
} from "@/lib/rate-limit";
import { ensureViewerProfile } from "@/lib/viewer-profile";

const FAVORITE_LIMIT = 9;

async function canMutateCharacterFavorite(userId: string, action = "favorite") {
  const ip = await getClientIpFromCurrentRequest();
  const rateLimit = await consumeRateLimit({
    key: `character:${action}:${ip}:${userId}`,
    limit: 60,
    windowMs: 60 * 1000,
  });

  return rateLimit.allowed;
}

async function reorderFavoriteCharacterPositions(tx: Transaction, userId: string, ids: string[]) {
  for (const sign of [-1, 1]) {
    for (const [index, id] of ids.entries()) {
      await tx.update(favoriteCharacters).set({ position: sign * (index + 1), updatedAt: new Date() })
        .where(and(eq(favoriteCharacters.id, id), eq(favoriteCharacters.userId, userId)));
    }
  }
}

async function normalizeFavoriteCharacterPositions(tx: Transaction, userId: string) {
  const rows = await tx
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
      await tx
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

  const result = await withTransaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, profile.id)).for("no key update");
    const [existing] = await tx
      .select({ id: favoriteCharacters.id })
      .from(favoriteCharacters)
      .where(and(eq(favoriteCharacters.userId, profile.id), eq(favoriteCharacters.malId, malId)))
      .limit(1);

    if (existing) {
      await tx.delete(favoriteCharacters).where(eq(favoriteCharacters.id, existing.id));
      await normalizeFavoriteCharacterPositions(tx, profile.id);
      return { ok: true as const, favorited: false };
    }

    const currentFavorites = await tx
      .select({ id: favoriteCharacters.id })
      .from(favoriteCharacters)
      .where(eq(favoriteCharacters.userId, profile.id))
      .orderBy(asc(favoriteCharacters.position), asc(favoriteCharacters.createdAt));

    if (currentFavorites.length >= FAVORITE_LIMIT) {
      return { ok: false as const, reason: "limit" as const };
    }

    await tx.insert(favoriteCharacters).values({
      userId: profile.id,
      malId,
      position: currentFavorites.length + 1,
      updatedAt: new Date(),
    });


    return { ok: true as const, favorited: true };
  });
  if (result.ok) {
    revalidatePath(`/characters/${malId}`);
    revalidatePath(`/u/${profile.username}`);
  }
  return result;

}

export async function saveFavoriteCharacterOrderAction(ids: string[]) {
  const profile = await ensureViewerProfile({ allowCookieMutation: true });

  if (!profile) {
    redirect("/auth/sign-in");
  }

  if (!z.array(z.uuid()).min(1).max(FAVORITE_LIMIT).safeParse(ids).success || new Set(ids).size !== ids.length) {
    return false;
  }

  if (!(await canMutateCharacterFavorite(profile.id, "reorder"))) {
    return false;
  }

  const saved = await withTransaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, profile.id)).for("no key update");
    const rows = await tx
      .select({ id: favoriteCharacters.id })
      .from(favoriteCharacters)
      .where(eq(favoriteCharacters.userId, profile.id));

    const existingIds = new Set(rows.map((row) => row.id));

    if (rows.length !== ids.length || ids.some((id) => !existingIds.has(id))) {
      return false;
    }

    await reorderFavoriteCharacterPositions(tx, profile.id, ids);
    return true;
  });
  if (!saved) return false;
  revalidatePath(`/u/${profile.username}`);

  return true;
}
