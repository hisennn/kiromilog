import { NextResponse } from "next/server";
import { z } from "zod";

import { getThreadForViewer } from "@/lib/chat";
import { getPusherServer } from "@/lib/pusher/server";
import {
  consumeRateLimit,
  getClientIpFromRequest,
  secondsUntilReset,
} from "@/lib/rate-limit";
import { getSession } from "@/lib/auth/server";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const ip = getClientIpFromRequest(request);
  const rateLimit = await consumeRateLimit({
    key: `api:pusher-auth:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
    failClosed: true,
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

  const session = await getSession({ disableCookieCache: true });
  if (!session?.user?.emailVerified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const viewerId = session.user.id;
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const socketId = String(formData.get("socket_id") ?? "");
  const channelName = String(formData.get("channel_name") ?? "");

  if (socketId.length > 128 || !/^\d+\.\d+$/.test(socketId)) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  if (channelName === `private-user-${viewerId}`) {
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
  if (!z.uuid().safeParse(threadId).success) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }
  const thread = await getThreadForViewer(threadId, viewerId);

  if (!thread) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const pusher = getPusherServer();

  if (!pusher) {
    return NextResponse.json({ error: "Pusher is not configured" }, { status: 503 });
  }

  return NextResponse.json(pusher.authorizeChannel(socketId, channelName));
}
