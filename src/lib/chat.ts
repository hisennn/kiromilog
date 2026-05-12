import "server-only";

import { and, asc, desc, eq, or } from "drizzle-orm";

import { isMutualFollow } from "@/lib/social-actions";
import { db } from "@/lib/db";
import { chatMessages, chatThreads, users } from "@/lib/db/schema";

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

export async function getThreadPeer(thread: typeof chatThreads.$inferSelect, viewerId: string) {
  const peerId =
    thread.participantAId === viewerId
      ? thread.participantBId
      : thread.participantAId;

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

export async function getThreadMessages(threadId: string): Promise<ChatMessageView[]> {
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
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(asc(chatMessages.createdAt))
    .limit(100);

  return rows.map((row) => ({
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

export async function getViewerThreads(viewerId: string) {
  const rows = await db
    .select()
    .from(chatThreads)
    .where(
      or(
        eq(chatThreads.participantAId, viewerId),
        eq(chatThreads.participantBId, viewerId),
      ),
    )
    .orderBy(desc(chatThreads.lastMessageAt), desc(chatThreads.updatedAt));

  return Promise.all(
    rows.map(async (thread) => {
      const [peer, lastMessageRows] = await Promise.all([
        getThreadPeer(thread, viewerId),
        db
          .select({
            body: chatMessages.body,
            senderId: chatMessages.senderId,
            createdAt: chatMessages.createdAt,
          })
          .from(chatMessages)
          .where(eq(chatMessages.threadId, thread.id))
          .orderBy(desc(chatMessages.createdAt))
          .limit(1),
      ]);

      return {
        thread,
        peer,
        lastMessage: lastMessageRows[0]
          ? {
              ...lastMessageRows[0],
              createdAt: lastMessageRows[0].createdAt.toISOString(),
            }
          : null,
      };
    }),
  );
}

export type ViewerThreadPreview = Awaited<ReturnType<typeof getViewerThreads>>[number];
