import "server-only";

import { and, desc, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  activities,
  activityLikeNotifications,
  users,
} from "@/lib/db/schema";
import { getActivitySummaryText } from "@/lib/activity-copy";
import { ActivityPayload } from "@/lib/media-payload";

export type ActivityLikeNotificationView = {
  id: string;
  actorId: string;
  activityCount: number;
  latestActivityId: string | null;
  latestActivityTitle: string | null;
  latestActivityText: string | null;
  updatedAt: string;
  actor: {
    username: string;
    nickname: string;
    avatarUrl: string | null;
  };
};

export async function getUnreadActivityLikeNotifications(userId: string) {
  const rows = await db
    .select({
      id: activityLikeNotifications.id,
      actorId: activityLikeNotifications.actorId,
      activityCount: activityLikeNotifications.activityCount,
      latestActivityId: activityLikeNotifications.latestActivityId,
      updatedAt: activityLikeNotifications.updatedAt,
      actorUsername: users.username,
      actorNickname: users.nickname,
      actorAvatarUrl: users.avatarUrl,
      latestPayload: activities.payload,
      latestKind: activities.kind,
      latestMediaKind: activities.mediaKind,
      latestStatus: activities.status,
      latestProgressFrom: activities.progressFrom,
      latestProgressTo: activities.progressTo,
    })
    .from(activityLikeNotifications)
    .innerJoin(users, eq(users.id, activityLikeNotifications.actorId))
    .leftJoin(activities, eq(activities.id, activityLikeNotifications.latestActivityId))
    .where(
      and(
        eq(activityLikeNotifications.recipientId, userId),
        ne(activityLikeNotifications.actorId, userId),
        isNull(activityLikeNotifications.readAt),
      ),
    )
    .orderBy(desc(activityLikeNotifications.updatedAt))
    .limit(12);

  return rows.map((row): ActivityLikeNotificationView => {
    const payload = row.latestPayload as ActivityPayload | null;
    const latestActivityText = row.latestKind
      ? getActivitySummaryText({
          kind: row.latestKind,
          mediaKind: row.latestMediaKind,
          status: row.latestStatus,
          progressFrom: row.latestProgressFrom,
          progressTo: row.latestProgressTo,
          title: payload?.title ?? null,
        })
      : null;

    return {
      id: row.id,
      actorId: row.actorId,
      activityCount: row.activityCount,
      latestActivityId: row.latestActivityId,
      latestActivityTitle: payload?.title ?? null,
      latestActivityText,
      updatedAt: row.updatedAt.toISOString(),
      actor: {
        username: row.actorUsername,
        nickname: row.actorNickname,
        avatarUrl: row.actorAvatarUrl,
      },
    };
  });
}
