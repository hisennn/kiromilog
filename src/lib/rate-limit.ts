import "server-only";

import { headers } from "next/headers";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

function now() {
  return Date.now();
}

function cleanupBuckets(currentTime: number) {
  if (buckets.size < 10000) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= currentTime) {
      buckets.delete(key);
    }
  }
}

export function consumeRateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  const currentTime = now();
  cleanupBuckets(currentTime);

  const current = buckets.get(key);

  if (!current || current.resetAt <= currentTime) {
    const resetAt = currentTime + windowMs;
    buckets.set(key, { count: 1, resetAt });

    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt,
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;

  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

export function getClientIpFromHeaders(headerStore: Headers) {
  return (
    headerStore.get("cf-connecting-ip") ||
    headerStore.get("x-real-ip") ||
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function getClientIpFromRequest(request: Request) {
  return getClientIpFromHeaders(request.headers);
}

export async function getClientIpFromCurrentRequest() {
  return getClientIpFromHeaders(await headers());
}

export function secondsUntilReset(resetAt: number) {
  return Math.max(1, Math.ceil((resetAt - now()) / 1000));
}
