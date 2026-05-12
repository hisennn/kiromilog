"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  ChatMessageView,
  getOrCreateThreadForUsers,
  getThreadForViewer,
  getThreadMessages,
  getThreadPeer,
} from "@/lib/chat";
import { db } from "@/lib/db";
import { chatMessages, chatThreads, users } from "@/lib/db/schema";
import { getPusherServer } from "@/lib/pusher/server";
import {
  consumeRateLimit,
  getClientIpFromCurrentRequest,
} from "@/lib/rate-limit";
import { isMutualFollow } from "@/lib/social-actions";
import { ensureViewerProfile } from "@/lib/viewer-profile";

const messageSchema = z.object({
  threadId: z.uuid(),
  body: z.string().trim().min(1).max(500),
});

export async function startChatAction(formData: FormData) {
  const viewer = await ensureViewerProfile({ allowCookieMutation: true });
  const ip = await getClientIpFromCurrentRequest();
  const rateLimit = consumeRateLimit({
    key: `chat:start:${ip}:${viewer.id}`,
    limit: 30,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    redirect("/messages");
  }

  const username = String(formData.get("username") ?? "");

  const [peer] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!peer || peer.id === viewer.id) {
    redirect(`/u/${username}`);
  }

  const thread = await getOrCreateThreadForUsers(viewer.id, peer.id);

  if (!thread) {
    redirect(`/u/${peer.username}`);
  }

  redirect(`/messages/${thread.id}`);
}

export async function sendChatMessageAction(
  formData: FormData,
): Promise<
  | { ok: true; message: ChatMessageView }
  | { ok: false; error: "invalid" | "forbidden" | "not-found" }
> {
  const viewer = await ensureViewerProfile({ allowCookieMutation: true });
  const ip = await getClientIpFromCurrentRequest();
  const parsed = messageSchema.safeParse({
    threadId: formData.get("threadId"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }

  const rateLimit = consumeRateLimit({
    key: `chat:send:${ip}:${viewer.id}:${parsed.data.threadId}`,
    limit: 45,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return { ok: false, error: "forbidden" };
  }

  const thread = await getThreadForViewer(parsed.data.threadId, viewer.id);

  if (!thread) {
    return { ok: false, error: "not-found" };
  }

  const peer = await getThreadPeer(thread, viewer.id);

  if (!peer || !(await isMutualFollow(viewer.id, peer.id))) {
    return { ok: false, error: "forbidden" };
  }

  const now = new Date();
  const [message] = await db
    .insert(chatMessages)
    .values({
      threadId: thread.id,
      senderId: viewer.id,
      body: parsed.data.body,
    })
    .returning({
      id: chatMessages.id,
      body: chatMessages.body,
      senderId: chatMessages.senderId,
      createdAt: chatMessages.createdAt,
    });

  await db
    .update(chatThreads)
    .set({
      lastMessageAt: now,
      updatedAt: now,
    })
    .where(eq(chatThreads.id, thread.id));

  const view: ChatMessageView = {
    id: message.id,
    body: message.body,
    senderId: message.senderId,
    createdAt: message.createdAt.toISOString(),
    timeLabel: new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(message.createdAt),
    sender: {
      username: viewer.username,
      nickname: viewer.nickname,
      avatarUrl: viewer.avatarUrl,
    },
  };

  const pusher = getPusherServer();
  await pusher?.trigger(`private-chat-${thread.id}`, "message:new", view);
  await pusher?.trigger(`private-user-${peer.id}`, "notification:new", {
    threadId: thread.id,
    messageId: view.id,
    body: view.body,
    createdAt: view.createdAt,
    sender: view.sender,
  });

  revalidatePath("/messages");
  revalidatePath(`/messages/${thread.id}`);

  return { ok: true, message: view };
}

export async function refreshChatMessagesAction(threadId: string) {
  const viewer = await ensureViewerProfile({ allowCookieMutation: true });
  const ip = await getClientIpFromCurrentRequest();
  const rateLimit = consumeRateLimit({
    key: `chat:refresh:${ip}:${viewer.id}:${threadId}`,
    limit: 90,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return [];
  }

  const thread = await getThreadForViewer(threadId, viewer.id);

  if (!thread) {
    return [];
  }

  return getThreadMessages(thread.id);
}
