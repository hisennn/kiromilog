import { AppHeader } from "@/components/app/app-header";
import { MessageThreadList } from "@/components/chat/message-thread-list";
import { getViewerThreads } from "@/lib/chat";
import { ensureViewerProfile } from "@/lib/viewer-profile";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const viewer = await ensureViewerProfile();
  const threads = await getViewerThreads(viewer.id);

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
        <MessageThreadList threads={threads} viewerId={viewer.id} />
        <article className="message-chat-panel message-chat-empty-panel">
          <div>
            <p className="eyebrow">Select a conversation</p>
            <p className="mt-2 text-sm text-muted">
              Chats are available when both people follow each other.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
