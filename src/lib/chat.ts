import "server-only";

import { z } from "zod";

import { and, desc, eq, gt, inArray, or } from "drizzle-orm";

import { isMutualFollow } from "@/lib/social";
import { db, sql } from "@/lib/db";
import { chatMessages, chatThreadClears, chatThreads, users } from "@/lib/db/schema";

export type ChatMessageView = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  timeLabel: string;
  sender: {
    username: string;
    nickname: string;
    avatarUrl: string | null;
  };
};

function formatMessageTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function getOrderedParticipantIds(userAId: string, userBId: string) {
  return userAId < userBId
    ? { participantAId: userAId, participantBId: userBId }
    : { participantAId: userBId, participantBId: userAId };
}

export async function findThreadForUsers(userAId: string, userBId: string) {
  const participants = getOrderedParticipantIds(userAId, userBId);

  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(
      and(
        eq(chatThreads.participantAId, participants.participantAId),
        eq(chatThreads.participantBId, participants.participantBId),
      ),
    )
    .limit(1);

  return thread ?? null;
}

export async function getOrCreateThreadForUsers(userAId: string, userBId: string) {
  if (!(await isMutualFollow(userAId, userBId))) {
    return null;
  }

  const existing = await findThreadForUsers(userAId, userBId);

  if (existing) {
    return existing;
  }

  const participants = getOrderedParticipantIds(userAId, userBId);
  const [thread] = await db
    .insert(chatThreads)
    .values({
      ...participants,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [chatThreads.participantAId, chatThreads.participantBId],
      set: {
        updatedAt: new Date(),
      },
    })
    .returning();

  return thread;
}

export async function getThreadForViewer(threadId: string, viewerId: string) {
  if (!z.uuid().safeParse(threadId).success) return null;
  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(
      and(
        eq(chatThreads.id, threadId),
        or(
          eq(chatThreads.participantAId, viewerId),
          eq(chatThreads.participantBId, viewerId),
        ),
      ),
    )
    .limit(1);

  return thread ?? null;
}

function getPeerId(thread: typeof chatThreads.$inferSelect, viewerId: string) {
  return thread.participantAId === viewerId ? thread.participantBId : thread.participantAId;
}

function normalizeChatRows(result: unknown) {
  if (Array.isArray(result)) {
    return result as Array<Record<string, unknown>>;
  }

  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: Array<Record<string, unknown>> }).rows;
  }

  return [];
}

export async function getThreadPeer(thread: typeof chatThreads.$inferSelect, viewerId: string) {
  const peerId = getPeerId(thread, viewerId);

  const [peer] = await db
    .select({
      id: users.id,
      username: users.username,
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, peerId))
    .limit(1);

  return peer ?? null;
}

export async function getThreadClearCutoff(threadId: string, viewerId: string) {
  const [row] = await db
    .select({ clearedAt: chatThreadClears.clearedAt })
    .from(chatThreadClears)
    .where(
      and(
        eq(chatThreadClears.threadId, threadId),
        eq(chatThreadClears.userId, viewerId),
      ),
    )
    .limit(1);

  return row?.clearedAt ?? null;
}

export async function clearThreadForViewer(threadId: string, viewerId: string) {
  const now = new Date();

  await db
    .insert(chatThreadClears)
    .values({
      threadId,
      userId: viewerId,
      clearedAt: now,
    })
    .onConflictDoUpdate({
      target: [chatThreadClears.threadId, chatThreadClears.userId],
      set: { clearedAt: now },
    });

  return now;
}

export async function getThreadMessages(threadId: string, viewerId?: string): Promise<ChatMessageView[]> {
  const cutoff = viewerId ? await getThreadClearCutoff(threadId, viewerId) : null;
  const rows = await db
    .select({
      id: chatMessages.id,
      body: chatMessages.body,
      senderId: chatMessages.senderId,
      createdAt: chatMessages.createdAt,
      username: users.username,
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
    })
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.senderId))
    .where(
      cutoff
        ? and(eq(chatMessages.threadId, threadId), gt(chatMessages.createdAt, cutoff))
        : eq(chatMessages.threadId, threadId),
    )
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(100);

  return rows.reverse().map((row) => ({
    id: row.id,
    body: row.body,
    senderId: row.senderId,
    createdAt: row.createdAt.toISOString(),
    timeLabel: formatMessageTime(row.createdAt),
    sender: {
      username: row.username,
      nickname: row.nickname,
      avatarUrl: row.avatarUrl,
    },
  }));
}

export function getThreadPage(input?: string) {
  const page = Number(input);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 1000) : 1;
}

export async function getViewerThreads(viewerId: string, page = 1) {
  const pageSize = 50;
  const offset = (getThreadPage(String(page)) - 1) * pageSize;
  const rows = await db
    .select()
    .from(chatThreads)
    .where(
      or(
        eq(chatThreads.participantAId, viewerId),
        eq(chatThreads.participantBId, viewerId),
      ),
    )
    .orderBy(desc(chatThreads.lastMessageAt), desc(chatThreads.updatedAt), desc(chatThreads.id))
    .limit(pageSize + 1)
    .offset(offset);

  const hasMore = page < 1000 && rows.length > pageSize;
  rows.splice(pageSize);
  if (!rows.length) {
    return { items: [], hasMore: false };
  }

  const threadIds = rows.map((thread) => thread.id);
  const peerIds = [...new Set(rows.map((thread) => getPeerId(thread, viewerId)))];
  const placeholders = threadIds.map((_, index) => `$${index + 2}`).join(", ");

  const [peerRows, lastMessageResult] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(inArray(users.id, peerIds)),
    sql.query(
      `SELECT DISTINCT ON (m.thread_id) m.thread_id, m.body, m.sender_id, m.created_at
       FROM chat_messages m
       LEFT JOIN chat_thread_clears c ON c.thread_id = m.thread_id AND c.user_id = $1
       WHERE m.thread_id IN (${placeholders})
         AND (c.cleared_at IS NULL OR m.created_at > c.cleared_at)
       ORDER BY m.thread_id, m.created_at DESC, m.id DESC`,
      [viewerId, ...threadIds],
    ),
  ]);

  const peerById = new Map(peerRows.map((peer) => [peer.id, peer]));
  const lastMessageByThreadId = new Map(
    normalizeChatRows(lastMessageResult).map((row) => [row.thread_id as string, row]),
  );

  const items = rows.map((thread) => {
    const lastMessage = lastMessageByThreadId.get(thread.id);
    const createdAt =
      lastMessage?.created_at instanceof Date
        ? lastMessage.created_at
        : lastMessage?.created_at
          ? new Date(lastMessage.created_at as string)
          : null;

    return {
      thread,
      peer: peerById.get(getPeerId(thread, viewerId)) ?? null,
      lastMessage:
        lastMessage && createdAt && !Number.isNaN(createdAt.getTime())
          ? {
              body: lastMessage.body as string,
              senderId: lastMessage.sender_id as string,
              createdAt: createdAt.toISOString(),
            }
          : null,
    };
  });
  return { items, hasMore };
}

export type ViewerThreadPreview = Awaited<ReturnType<typeof getViewerThreads>>["items"][number];
