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
            <p className="eyebrow">Selecione uma conversa</p>
            <p className="mt-2 text-sm text-muted">
              Chats ficam disponiveis quando as duas pessoas se seguem.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
