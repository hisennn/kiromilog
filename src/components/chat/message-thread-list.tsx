import Image from "next/image";
import Link from "next/link";

type MessageThreadListProps = {
  threads: Array<{
    thread: { id: string };
    peer: {
      username: string;
      nickname: string;
      avatarUrl: string | null;
    } | null;
    lastMessage: {
      body: string;
      senderId: string;
      createdAt: string;
    } | null;
  }>;
  activeThreadId?: string;
  viewerId: string;
};

export function MessageThreadList({
  threads,
  activeThreadId,
  viewerId,
}: MessageThreadListProps) {
  return (
    <aside className="message-sidebar">
      <div className="message-sidebar-head">
        <p className="eyebrow">Messages</p>
        <h1>Chats</h1>
      </div>

      <div className="message-thread-list">
        {threads.length ? (
          threads.map(({ thread, peer, lastMessage }) =>
            peer ? (
              <Link
                className={`message-thread-item ${
                  activeThreadId === thread.id ? "message-thread-item-active" : ""
                }`}
                href={`/messages/${thread.id}`}
                key={thread.id}
              >
                <span className="message-thread-avatar">
                  {peer.avatarUrl ? (
                    <Image
                      alt=""
                      className="object-cover"
                      fill
                      sizes="44px"
                      src={peer.avatarUrl}
                    />
                  ) : (
                    <span>{peer.username.slice(0, 1).toUpperCase()}</span>
                  )}
                </span>
                <span className="message-thread-copy">
                  <span className="message-thread-name">@{peer.username}</span>
                  <span className="message-thread-preview">
                    {lastMessage
                      ? `${lastMessage.senderId === viewerId ? "You: " : ""}${lastMessage.body}`
                      : "No messages yet"}
                  </span>
                </span>
              </Link>
            ) : null,
          )
        ) : (
          <div className="message-thread-empty">
            Follow someone who follows you back to start a conversation.
          </div>
        )}
      </div>
    </aside>
  );
}
