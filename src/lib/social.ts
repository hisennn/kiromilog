import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { userFollows } from "@/lib/db/schema";

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
