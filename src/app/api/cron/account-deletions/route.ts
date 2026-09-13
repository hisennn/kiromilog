import { retryAccountDeletions } from "@/lib/account-deletion";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await retryAccountDeletions();
  return Response.json(result, { status: result.failures ? 500 : 200 });
}
