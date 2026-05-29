import "server-only";

import { headers } from "next/headers";

import { sql } from "@/lib/db";

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

function normalizeRateLimitRows(result: unknown) {
  if (Array.isArray(result)) {
    return result as Array<{ count: number; reset_at: Date | string }>;
  }

  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: Array<{ count: number; reset_at: Date | string }> }).rows;
  }

  return [];
}

async function consumeDatabaseRateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult> {
  const resetAt = new Date(now() + windowMs);
  const result = await sql.query(
    `
      INSERT INTO rate_limit_buckets (key, count, reset_at, updated_at)
      VALUES ($1, 1, $3, NOW())
      ON CONFLICT (key) DO UPDATE
      SET
        count = CASE
          WHEN rate_limit_buckets.reset_at <= NOW() THEN 1
          WHEN rate_limit_buckets.count < $2 THEN rate_limit_buckets.count + 1
          ELSE rate_limit_buckets.count
        END,
        reset_at = CASE
          WHEN rate_limit_buckets.reset_at <= NOW() THEN $3
          ELSE rate_limit_buckets.reset_at
        END,
        updated_at = NOW()
      RETURNING count, reset_at
    `,
    [key, limit, resetAt],
  );
  const row = normalizeRateLimitRows(result)[0];

  if (!row) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: resetAt.getTime(),
    };
  }

  const count = Number(row.count);
  const rowResetAt =
    row.reset_at instanceof Date
      ? row.reset_at.getTime()
      : new Date(row.reset_at).getTime();

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: rowResetAt,
  };
}

function consumeMemoryRateLimit({
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

export async function consumeRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  try {
    return await consumeDatabaseRateLimit(options);
  } catch {
    return consumeMemoryRateLimit(options);
  }
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
