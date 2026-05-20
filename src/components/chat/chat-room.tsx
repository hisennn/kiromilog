"use client";

import { Send } from "iconoir-react";
import Pusher from "pusher-js";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  refreshChatMessagesAction,
  sendChatMessageAction,
} from "@/lib/chat-actions";
import type { ChatMessageView } from "@/lib/chat";
import { markThreadRead } from "@/lib/message-notification-store";

type ChatRoomProps = {
  threadId: string;
  viewerId: string;
  initialMessages: ChatMessageView[];
  peer: {
    username: string;
    avatarUrl: string | null;
  };
  canMessage: boolean;
  disabledReason?: string;
  pusherKey?: string;
  pusherCluster?: string;
};

export function ChatRoom({
  threadId,
  viewerId,
  initialMessages,
  peer,
  canMessage,
  disabledReason,
  pusherKey,
  pusherCluster,
}: ChatRoomProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);

  const appendMessage = useCallback((message: ChatMessageView) => {
    setMessages((current) =>
      current.some((item) => item.id === message.id)
        ? current
        : [...current, message],
    );
  }, []);

  useEffect(() => {
    markThreadRead(viewerId, threadId);
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, threadId, viewerId]);

  useEffect(() => {
    if (!pusherKey || !pusherCluster) {
      const timer = window.setInterval(async () => {
        const fresh = await refreshChatMessagesAction(threadId);
        setMessages(fresh);
      }, 4000);

      return () => window.clearInterval(timer);
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
      channelAuthorization: {
        endpoint: "/api/pusher/auth",
        transport: "ajax",
      },
    });
    const channel = pusher.subscribe(`private-chat-${threadId}`);

    channel.bind("message:new", (message: ChatMessageView) => {
      appendMessage(message);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-chat-${threadId}`);
      pusher.disconnect();
    };
  }, [appendMessage, pusherCluster, pusherKey, threadId]);

  function submitMessage() {
    const trimmed = body.trim();

    if (!trimmed || isPending || isSubmittingRef.current || !canMessage) {
      return;
    }

    const formData = new FormData();
    formData.set("threadId", threadId);
    formData.set("body", trimmed);
    setBody("");
    setError(null);
    isSubmittingRef.current = true;

    startTransition(async () => {
      try {
        const result = await sendChatMessageAction(formData);

        if (!result.ok) {
          setBody(trimmed);
          setError(
            result.error === "forbidden"
              ? "You can only message someone who follows you back."
              : "Could not send the message.",
          );
          return;
        }

        appendMessage(result.message);
      } catch {
        setBody(trimmed);
        setError("Could not send the message.");
      } finally {
        isSubmittingRef.current = false;
      }
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  }

  return (
    <section className="message-chat-panel">
      <Link className="message-chat-head" href={`/u/${peer.username}`}>
        <span className="message-chat-avatar">
          {peer.avatarUrl ? (
            <Image alt="" className="object-cover" fill sizes="48px" src={peer.avatarUrl} />
          ) : (
            <span>{peer.username.slice(0, 1).toUpperCase()}</span>
          )}
        </span>
        <span>
          <span className="message-chat-title">@{peer.username}</span>
          <span className="message-chat-subtitle">View profile</span>
        </span>
      </Link>

      <div className="message-chat-scroll">
        {messages.length ? (
          messages.map((message) => {
            const mine = message.senderId === viewerId;

            return (
              <article
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
                key={message.id}
              >
                <div
                  className={`message-bubble ${
                    mine
                      ? "message-bubble-own"
                      : "message-bubble-peer"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-muted">
                    {message.timeLabel}
                  </p>
                </div>
              </article>
            );
          })
        ) : (
          <div className="flex h-full min-h-80 items-center justify-center text-center">
            <div>
              <p className="eyebrow">No messages yet</p>
              <p className="mt-2 text-sm text-muted">Start the conversation.</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="message-composer" onSubmit={handleSubmit}>
        {!canMessage ? (
          <p className="message-composer-disabled">
            {disabledReason ?? "You both need to follow each other to exchange messages."}
          </p>
        ) : null}
        {error ? <p className="mb-2 text-sm text-accent">{error}</p> : null}
        <div className="flex gap-2">
          <textarea
            className="input message-composer-input"
            disabled={!canMessage}
            maxLength={500}
            name="body"
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            rows={1}
            value={body}
          />
          <button className="button button-primary shrink-0" disabled={isPending || !canMessage} type="submit">
            <Send aria-hidden="true" width={18} height={18} strokeWidth={2.2} />
            <span className="sr-only">Send</span>
          </button>
        </div>
      </form>
    </section>
  );
}
