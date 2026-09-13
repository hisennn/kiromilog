import { timingSafeEqual } from "node:crypto";
import { retryAccountDeletions } from "@/lib/account-deletion";
import { getCronSecret } from "@/lib/env";
import { sql } from "@/lib/db";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = getCronSecret();
  const authorization = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);

  if (!secret || authorization.length !== expected.length || !timingSafeEqual(authorization, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sql.query("DELETE FROM rate_limit_buckets WHERE reset_at <= NOW()");
    const result = await retryAccountDeletions();
    return Response.json(result, { status: result.failures ? 500 : 200 });
  } catch {
    console.error("Scheduled account cleanup failed.");
    return Response.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
