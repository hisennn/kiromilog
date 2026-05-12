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

export async function isMutualFollow(userAId: string, userBId: string) {
  if (userAId === userBId) {
    return false;
  }

  const [aFollowsB, bFollowsA] = await Promise.all([
    db
      .select({ followerId: userFollows.followerId })
      .from(userFollows)
      .where(
        and(
          eq(userFollows.followerId, userAId),
          eq(userFollows.followingId, userBId),
        ),
      )
      .limit(1),
    db
      .select({ followerId: userFollows.followerId })
      .from(userFollows)
      .where(
        and(
          eq(userFollows.followerId, userBId),
          eq(userFollows.followingId, userAId),
        ),
      )
      .limit(1),
  ]);

  return Boolean(aFollowsB[0] && bFollowsA[0]);
}

export async function getFollowState(viewerId: string, profileId: string) {
  if (viewerId === profileId) {
    return {
      isSelf: true,
      isFollowing: false,
      isFollowedBy: false,
      isMutual: false,
    };
  }

  const [viewerFollowsProfile, profileFollowsViewer] = await Promise.all([
    db
      .select({ followerId: userFollows.followerId })
      .from(userFollows)
      .where(
        and(
          eq(userFollows.followerId, viewerId),
          eq(userFollows.followingId, profileId),
        ),
      )
      .limit(1),
    db
      .select({ followerId: userFollows.followerId })
      .from(userFollows)
      .where(
        and(
          eq(userFollows.followerId, profileId),
          eq(userFollows.followingId, viewerId),
        ),
      )
      .limit(1),
  ]);

  const isFollowing = Boolean(viewerFollowsProfile[0]);
  const isFollowedBy = Boolean(profileFollowsViewer[0]);

  return {
    isSelf: false,
    isFollowing,
    isFollowedBy,
    isMutual: isFollowing && isFollowedBy,
  };
}

export async function toggleFollowAction(formData: FormData) {
  const viewer = await ensureViewerProfile({ allowCookieMutation: true });
  const ip = await getClientIpFromCurrentRequest();
  const rateLimit = consumeRateLimit({
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
