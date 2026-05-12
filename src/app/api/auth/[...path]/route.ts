import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";
import {
  consumeRateLimit,
  getClientIpFromRequest,
  secondsUntilReset,
} from "@/lib/rate-limit";

const handler = auth.handler();

export const GET = handler.GET;

export async function POST(
  request: Parameters<typeof handler.POST>[0],
  context: Parameters<typeof handler.POST>[1],
) {
  const ip = getClientIpFromRequest(request);
  const rateLimit = consumeRateLimit({
    key: `api:auth:${ip}`,
    limit: 60,
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

  return handler.POST(request, context);
}
