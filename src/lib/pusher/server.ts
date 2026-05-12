import "server-only";

import Pusher from "pusher";

import { env } from "@/lib/env";

let pusher: Pusher | null = null;

export function getPusherServer() {
  if (
    !env.PUSHER_APP_ID ||
    !env.PUSHER_APP_KEY ||
    !env.PUSHER_APP_SECRET ||
    !env.NEXT_PUBLIC_PUSHER_CLUSTER
  ) {
    return null;
  }

  if (!pusher) {
    pusher = new Pusher({
      appId: env.PUSHER_APP_ID,
      key: env.PUSHER_APP_KEY,
      secret: env.PUSHER_APP_SECRET,
      cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER,
      useTLS: true,
    });
  }

  return pusher;
}
