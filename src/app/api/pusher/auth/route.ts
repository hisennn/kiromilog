import { NextResponse } from "next/server";

import { getThreadForViewer } from "@/lib/chat";
import { getPusherServer } from "@/lib/pusher/server";
import {
  consumeRateLimit,
  getClientIpFromRequest,
  secondsUntilReset,
} from "@/lib/rate-limit";
import { ensureViewerProfile } from "@/lib/viewer-profile";

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rateLimit = consumeRateLimit({
    key: `api:pusher-auth:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(secondsUntilReset(rateLimit.resetAt)),
        },
      },
    );
  }

  const viewer = await ensureViewerProfile({ allowCookieMutation: true });
  const formData = await request.formData();
  const socketId = String(formData.get("socket_id") ?? "");
  const channelName = String(formData.get("channel_name") ?? "");

  if (!socketId) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  if (channelName === `private-user-${viewer.id}`) {
    const pusher = getPusherServer();

    if (!pusher) {
      return NextResponse.json({ error: "Pusher is not configured" }, { status: 503 });
    }

    return NextResponse.json(pusher.authorizeChannel(socketId, channelName));
  }

  if (!channelName.startsWith("private-chat-")) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  const threadId = channelName.replace(/^private-chat-/, "");
  const thread = await getThreadForViewer(threadId, viewer.id);

  if (!thread) {
    return NextResponse.json({ error: "Access negado" }, { status: 403 });
  }

  const pusher = getPusherServer();

  if (!pusher) {
    return NextResponse.json({ error: "Pusher is not configured" }, { status: 503 });
  }

  return NextResponse.json(pusher.authorizeChannel(socketId, channelName));
}
