"use client";

export type MessageNotification = {
  threadId: string;
  messageId: string;
  body: string;
  createdAt: string;
  sender: {
    username: string;
    nickname: string;
    avatarUrl: string | null;
  };
  count: number;
};

export type MessageNotificationMap = Record<string, MessageNotification>;

export type ActivityLikeNotification = {
  id: string;
  actorId: string;
  activityCount: number;
  latestActivityId: string | null;
  latestActivityTitle: string | null;
  updatedAt: string;
  actor: {
    username: string;
    nickname: string;
    avatarUrl: string | null;
  };
};

export type ActivityLikeNotificationMap = Record<string, ActivityLikeNotification>;

const EVENT_NAME = "kiromilog-message-notifications-updated";
const ACTIVITY_EVENT_NAME = "kiromilog-activity-notifications-updated";

function getStorageKey(viewerId: string) {
  return `kiromilog_message_notifications_${viewerId}`;
}

function getActivityStorageKey(viewerId: string) {
  return `kiromilog_activity_like_notifications_${viewerId}`;
}

function emitUpdate() {
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function emitActivityUpdate() {
  window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT_NAME));
}

export function readMessageNotifications(viewerId: string): MessageNotificationMap {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(getStorageKey(viewerId));

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as MessageNotificationMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function markThreadUnread(viewerId: string, notification: Omit<MessageNotification, "count">) {
  const current = readMessageNotifications(viewerId);
  const previous = current[notification.threadId];

  window.localStorage.setItem(
    getStorageKey(viewerId),
    JSON.stringify({
      ...current,
      [notification.threadId]: {
        ...notification,
        count: previous ? previous.count + 1 : 1,
      },
    }),
  );
  emitUpdate();
}

export function readActivityLikeNotifications(viewerId: string): ActivityLikeNotificationMap {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(getActivityStorageKey(viewerId));

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as ActivityLikeNotificationMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function seedActivityLikeNotifications(
  viewerId: string,
  notifications: ActivityLikeNotification[],
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getActivityStorageKey(viewerId),
    JSON.stringify(Object.fromEntries(notifications.map((item) => [item.id, item]))),
  );
  emitActivityUpdate();
}

export function markActivityLikeUnread(
  viewerId: string,
  notification: ActivityLikeNotification,
) {
  const current = readActivityLikeNotifications(viewerId);

  window.localStorage.setItem(
    getActivityStorageKey(viewerId),
    JSON.stringify({
      ...current,
      [notification.id]: notification,
    }),
  );
  emitActivityUpdate();
}

export function markActivityLikeNotificationsRead(viewerId: string) {
  window.localStorage.setItem(getActivityStorageKey(viewerId), JSON.stringify({}));
  emitActivityUpdate();
}

export function markThreadRead(viewerId: string, threadId: string) {
  const current = { ...readMessageNotifications(viewerId) };

  if (!current[threadId]) {
    return;
  }

  delete current[threadId];
  window.localStorage.setItem(getStorageKey(viewerId), JSON.stringify(current));
  emitUpdate();
}

export function subscribeToMessageNotifications(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener(ACTIVITY_EVENT_NAME, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener(ACTIVITY_EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}
