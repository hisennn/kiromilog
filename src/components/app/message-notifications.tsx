"use client";

import Image from "next/image";
import Link from "next/link";
import Pusher from "pusher-js";
import { useEffect, useMemo, useRef, useState } from "react";

import { markActivityLikeNotificationsReadAction } from "@/lib/activity-like-actions";
import {
  markActivityLikeNotificationsRead,
  markActivityLikeUnread,
  markThreadRead,
  markThreadUnread,
  readActivityLikeNotifications,
  readMessageNotifications,
  seedActivityLikeNotifications,
  subscribeToMessageNotifications,
  type ActivityLikeNotification,
  type MessageNotification,
} from "@/lib/message-notification-store";

type MessageNotificationsProps = {
  viewerId: string;
  viewerUsername: string;
  pusherKey?: string;
  pusherCluster?: string;
  initialActivityLikeNotifications?: ActivityLikeNotification[];
};

export function MessageNotifications({
  viewerId,
  viewerUsername,
  pusherKey,
  pusherCluster,
  initialActivityLikeNotifications = [],
}: MessageNotificationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<MessageNotification[]>([]);
  const [activityNotifications, setActivityNotifications] = useState<ActivityLikeNotification[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const unreadMessageCount = useMemo(
    () => notifications.reduce((total, item) => total + item.count, 0),
    [notifications],
  );
  const unreadCount = unreadMessageCount + activityNotifications.length;
  const orderedNotifications = useMemo(
    () =>
      [
        ...activityNotifications.map((notification) => ({
          type: "activity-like" as const,
          sortDate: notification.updatedAt,
          notification,
        })),
        ...notifications.map((notification) => ({
          type: "message" as const,
          sortDate: notification.createdAt,
          notification,
        })),
      ].sort(
        (left, right) =>
          new Date(right.sortDate).getTime() - new Date(left.sortDate).getTime(),
      ),
    [activityNotifications, notifications],
  );

  useEffect(() => {
    seedActivityLikeNotifications(viewerId, initialActivityLikeNotifications);
  }, [initialActivityLikeNotifications, viewerId]);

  useEffect(() => {
    const sync = () => {
      const next = Object.values(readMessageNotifications(viewerId)).sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
      setNotifications(next);
      const nextActivityNotifications = Object.values(
        readActivityLikeNotifications(viewerId),
      ).sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      );
      setActivityNotifications(nextActivityNotifications);
    };

    sync();
    return subscribeToMessageNotifications(sync);
  }, [viewerId]);

  useEffect(() => {
    if (!pusherKey || !pusherCluster) {
      return;
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
      channelAuthorization: {
        endpoint: "/api/pusher/auth",
        transport: "ajax",
      },
    });
    const channel = pusher.subscribe(`private-user-${viewerId}`);

    channel.bind("notification:new", (notification: Omit<MessageNotification, "count">) => {
      if (window.location.pathname === `/messages/${notification.threadId}`) {
        return;
      }

      markThreadUnread(viewerId, notification);
    });
    channel.bind("activity-like:new", (notification: ActivityLikeNotification) => {
      markActivityLikeUnread(viewerId, notification);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-user-${viewerId}`);
      pusher.disconnect();
    };
  }, [pusherCluster, pusherKey, viewerId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  async function handleActivityNotificationClick() {
    markActivityLikeNotificationsRead(viewerId);
    setIsOpen(false);
    await markActivityLikeNotificationsReadAction();
  }

  return (
    <div className="message-notification" ref={wrapperRef}>
      <button
        aria-label="Notifications"
        className="message-notification-trigger"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="18"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="message-notification-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="message-notification-panel">
          <div className="message-notification-head">
            <strong>Notifications</strong>
            <span>{unreadCount} unread</span>
          </div>

          <div className="message-notification-list">
            {orderedNotifications.length ? (
              orderedNotifications.map((item) =>
                item.type === "message" ? (
                  <Link
                    className="message-notification-item"
                    href={`/messages/${item.notification.threadId}`}
                    key={`message-${item.notification.threadId}`}
                    onClick={() => {
                      markThreadRead(viewerId, item.notification.threadId);
                      setIsOpen(false);
                    }}
                  >
                    <span className="message-notification-avatar">
                      {item.notification.sender.avatarUrl ? (
                        <Image
                          alt=""
                          className="object-cover"
                          fill
                          sizes="42px"
                          src={item.notification.sender.avatarUrl}
                        />
                      ) : (
                        <span>{item.notification.sender.username.slice(0, 1).toUpperCase()}</span>
                      )}
                    </span>
                    <span className="message-notification-copy">
                      <span className="message-notification-title">
                        @{item.notification.sender.username}
                        {item.notification.count > 1 ? <em>x{item.notification.count}</em> : null}
                      </span>
                      <span className="message-notification-body">{item.notification.body}</span>
                    </span>
                    <span className="message-notification-dot" />
                  </Link>
                ) : (
                  <Link
                    className="message-notification-item"
                    href={`/u/${viewerUsername}?view=timeline`}
                    key={`activity-like-${item.notification.id}`}
                    onClick={handleActivityNotificationClick}
                  >
                    <span className="message-notification-avatar">
                      {item.notification.actor.avatarUrl ? (
                        <Image
                          alt=""
                          className="object-cover"
                          fill
                          sizes="42px"
                          src={item.notification.actor.avatarUrl}
                        />
                      ) : (
                        <span>{item.notification.actor.username.slice(0, 1).toUpperCase()}</span>
                      )}
                    </span>
                    <span className="message-notification-copy">
                      <span className="message-notification-title">
                        @{item.notification.actor.username}
                        {item.notification.activityCount > 1 ? (
                          <em>x{item.notification.activityCount}</em>
                        ) : null}
                      </span>
                      <span className="message-notification-body">
                        {item.notification.activityCount > 1
                          ? `liked ${item.notification.activityCount} posts`
                          : `liked: ${item.notification.latestActivityText ?? "your post"}`}
                      </span>
                    </span>
                    <span className="message-notification-dot" />
                  </Link>
                ),
              )
            ) : (
              <div className="message-notification-empty">No notifications.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
