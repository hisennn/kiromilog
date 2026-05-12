import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { ChatRoom } from "@/components/chat/chat-room";
import { MessageThreadList } from "@/components/chat/message-thread-list";
import { getThreadForViewer, getThreadMessages, getThreadPeer, getViewerThreads } from "@/lib/chat";
import { env } from "@/lib/env";
import { getFollowState } from "@/lib/social-actions";
import { ensureViewerProfile } from "@/lib/viewer-profile";

type ChatPageProps = {
  params: Promise<{
    threadId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: ChatPageProps) {
  const viewer = await ensureViewerProfile();
  const { threadId } = await params;
  const thread = await getThreadForViewer(threadId, viewer.id);

  if (!thread) {
    notFound();
  }

  const peer = await getThreadPeer(thread, viewer.id);

  if (!peer) {
    notFound();
  }

  const [messages, threads, followState] = await Promise.all([
    getThreadMessages(thread.id),
    getViewerThreads(viewer.id),
    getFollowState(viewer.id, peer.id),
  ]);
  const disabledReason = !followState.isFollowing
    ? "You need to follow this person to send messages."
    : !followState.isFollowedBy
      ? "This person needs to follow you back to receive messages."
      : undefined;

  return (
    <main className="app-shell animate-fade-in-up">
      <AppHeader
        avatarUrl={viewer.avatarUrl}
        current="messages"
        nickname={viewer.nickname}
        username={viewer.username}
        viewerId={viewer.id}
      />

      <section className="message-workspace">
        <MessageThreadList activeThreadId={thread.id} threads={threads} viewerId={viewer.id} />
        <ChatRoom
          canMessage={followState.isMutual}
          disabledReason={disabledReason}
          initialMessages={messages}
          peer={peer}
          pusherCluster={env.NEXT_PUBLIC_PUSHER_CLUSTER}
          pusherKey={env.NEXT_PUBLIC_PUSHER_APP_KEY}
          threadId={thread.id}
          viewerId={viewer.id}
        />
      </section>
    </main>
  );
}
