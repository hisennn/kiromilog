"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { userFollows, users } from "@/lib/db/schema";
import {
  consumeRateLimit,
  getClientIpFromCurrentRequest,
} from "@/lib/rate-limit";
import { ensureViewerProfile } from "@/lib/viewer-profile";

export async function toggleFollowAction(formData: FormData) {
  const viewer = await ensureViewerProfile({ allowCookieMutation: true });
  const ip = await getClientIpFromCurrentRequest();
  const rateLimit = await consumeRateLimit({
    key: `social:follow:${ip}:${viewer.id}`,
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    redirect(`/u/${viewer.username}`);
  }

  const username = String(formData.get("username") ?? "");

  const [target] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!target || target.id === viewer.id) {
    redirect(`/u/${username}`);
  }

  const [existing] = await db
    .select({ followerId: userFollows.followerId })
    .from(userFollows)
    .where(
      and(
        eq(userFollows.followerId, viewer.id),
        eq(userFollows.followingId, target.id),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .delete(userFollows)
      .where(
        and(
          eq(userFollows.followerId, viewer.id),
          eq(userFollows.followingId, target.id),
        ),
      );
  } else {
    await db
      .insert(userFollows)
      .values({
        followerId: viewer.id,
        followingId: target.id,
      })
      .onConflictDoNothing();
  }

  revalidatePath("/home");
  revalidatePath(`/u/${target.username}`);
  revalidatePath(`/u/${viewer.username}`);
}
