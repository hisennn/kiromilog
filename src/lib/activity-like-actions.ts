"use server";

import { and, count, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  activities,
  activityLikeNotificationItems,
  activityLikeNotifications,
  activityLikes,
  users,
} from "@/lib/db/schema";
import { getActivitySummaryText } from "@/lib/activity-copy";
import { ActivityPayload } from "@/lib/media-payload";
import { getPusherServer } from "@/lib/pusher/server";
import {
  consumeRateLimit,
  getClientIpFromCurrentRequest,
} from "@/lib/rate-limit";
import { ensureViewerProfile } from "@/lib/viewer-profile";

const toggleActivityLikeSchema = z.object({
  activityId: z.uuid(),
});

export async function toggleActivityLikeAction(
  formData: FormData,
): Promise<
  | { ok: true; liked: boolean; likeCount: number }
  | { ok: false; error: "invalid" | "limited" | "not-found" }
> {
  const viewer = await ensureViewerProfile({ allowCookieMutation: true });
  const ip = await getClientIpFromCurrentRequest();
  const parsed = toggleActivityLikeSchema.safeParse({
    activityId: formData.get("activityId"),
  });

  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }

  const rateLimit = consumeRateLimit({
    key: `activity:like:${ip}:${viewer.id}`,
    limit: 90,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return { ok: false, error: "limited" };
  }

  const [activity] = await db
    .select({
      id: activities.id,
      actorId: activities.actorId,
      kind: activities.kind,
      mediaKind: activities.mediaKind,
      status: activities.status,
      progressFrom: activities.progressFrom,
      progressTo: activities.progressTo,
      payload: activities.payload,
      username: users.username,
    })
    .from(activities)
    .innerJoin(users, eq(users.id, activities.actorId))
    .where(eq(activities.id, parsed.data.activityId))
    .limit(1);

  if (!activity) {
    return { ok: false, error: "not-found" };
  }

  const existingLike = await db
    .select({ activityId: activityLikes.activityId })
    .from(activityLikes)
    .where(
      and(
        eq(activityLikes.activityId, activity.id),
        eq(activityLikes.userId, viewer.id),
      ),
    )
    .limit(1);

  if (existingLike.length) {
    await db
      .delete(activityLikes)
      .where(
        and(
          eq(activityLikes.activityId, activity.id),
          eq(activityLikes.userId, viewer.id),
        ),
      );

    const likeCount = await getActivityLikeCount(activity.id);
    revalidateActivityViews(activity.username);

    return { ok: true, liked: false, likeCount };
  }

  await db.insert(activityLikes).values({
    activityId: activity.id,
    userId: viewer.id,
  });

  if (activity.actorId === viewer.id) {
    const likeCount = await getActivityLikeCount(activity.id);
    revalidateActivityViews(activity.username);

    return { ok: true, liked: true, likeCount };
  }

  const notification = await getOrCreateLikeNotification({
    recipientId: activity.actorId,
    actorId: viewer.id,
  });
  const notificationItem = await db
    .insert(activityLikeNotificationItems)
    .values({
      notificationId: notification.id,
      activityId: activity.id,
    })
    .onConflictDoNothing()
    .returning({ activityId: activityLikeNotificationItems.activityId });
  const shouldNotify = notificationItem.length > 0;

  if (shouldNotify) {
    const activityCount = await getNotificationActivityCount(
      notification.id,
      notification.readAt,
    );
    const now = new Date();

    await db
      .update(activityLikeNotifications)
      .set({
        latestActivityId: activity.id,
        activityCount,
        readAt: null,
        updatedAt: now,
      })
      .where(eq(activityLikeNotifications.id, notification.id));

    const payload = activity.payload as ActivityPayload | null;
    const latestActivityText = getActivitySummaryText({
      kind: activity.kind,
      mediaKind: activity.mediaKind,
      status: activity.status,
      progressFrom: activity.progressFrom,
      progressTo: activity.progressTo,
      title: payload?.title ?? null,
    });
    const pusher = getPusherServer();
    await pusher?.trigger(`private-user-${activity.actorId}`, "activity-like:new", {
      id: notification.id,
      actorId: viewer.id,
      activityCount,
      latestActivityId: activity.id,
      latestActivityTitle: payload?.title ?? null,
      latestActivityText,
      updatedAt: now.toISOString(),
      actor: {
        username: viewer.username,
        nickname: viewer.nickname,
        avatarUrl: viewer.avatarUrl,
      },
    });
  }

  const likeCount = await getActivityLikeCount(activity.id);
  revalidateActivityViews(activity.username);

  return { ok: true, liked: true, likeCount };
}

export async function markActivityLikeNotificationsReadAction() {
  const viewer = await ensureViewerProfile({ allowCookieMutation: true });

  await db
    .update(activityLikeNotifications)
    .set({
      readAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activityLikeNotifications.recipientId, viewer.id));
}

async function getActivityLikeCount(activityId: string) {
  const [row] = await db
    .select({ count: count() })
    .from(activityLikes)
    .where(eq(activityLikes.activityId, activityId));

  return row?.count ?? 0;
}

async function getNotificationActivityCount(
  notificationId: string,
  readAt: Date | null = null,
) {
  const [row] = await db
    .select({ count: count() })
    .from(activityLikeNotificationItems)
    .where(
      readAt
        ? and(
            eq(activityLikeNotificationItems.notificationId, notificationId),
            gt(activityLikeNotificationItems.createdAt, readAt),
          )
        : eq(activityLikeNotificationItems.notificationId, notificationId),
    );

  return row?.count ?? 0;
}

async function getOrCreateLikeNotification(input: {
  recipientId: string;
  actorId: string;
}) {
  const [notification] = await db
    .insert(activityLikeNotifications)
    .values({
      recipientId: input.recipientId,
      actorId: input.actorId,
    })
    .onConflictDoUpdate({
      target: [
        activityLikeNotifications.recipientId,
        activityLikeNotifications.actorId,
      ],
      set: {
        updatedAt: new Date(),
      },
    })
    .returning({
      id: activityLikeNotifications.id,
      readAt: activityLikeNotifications.readAt,
    });

  return notification;
}

function revalidateActivityViews(username: string) {
  revalidatePath("/home");
  revalidatePath(`/u/${username}`);
}
