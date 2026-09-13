import "server-only";

import { eq } from "drizzle-orm";

import { db, sql } from "@/lib/db";
import { accountDeletionJobs, users } from "@/lib/db/schema";
import { utapi } from "@/lib/uploadthing";

export async function prepareAccountDeletion(userId: string) {
  const [profile] = await db
    .select({ avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  await db
    .insert(accountDeletionJobs)
    .values({
      userId,
      avatarPath: profile?.avatarPath ?? null,
    })
    .onConflictDoUpdate({
      target: accountDeletionJobs.userId,
      set: { avatarPath: profile?.avatarPath ?? null },
    });
}

export async function completeAccountDeletion(userId: string) {
  const [job] = await db
    .select()
    .from(accountDeletionJobs)
    .where(eq(accountDeletionJobs.userId, userId))
    .limit(1);

  if (!job) {
    return;
  }

  // An unsuccessful or ambiguous Auth request must never erase an active account.
  const identities = await sql.query(
    'SELECT id FROM neon_auth."user" WHERE id = $1::uuid',
    [userId],
  );

  if (identities.length) {
    return;
  }

  await db.delete(users).where(eq(users.id, userId));

  if (job.avatarPath?.startsWith("uploadthing:")) {
    const result = await utapi.deleteFiles(job.avatarPath.slice("uploadthing:".length));

    if (!result.success) {
      throw new Error("Account avatar cleanup failed.");
    }
  }

  await db.delete(accountDeletionJobs).where(eq(accountDeletionJobs.userId, userId));
}

export async function retryAccountDeletions() {
  const jobs = await sql.query(
    `SELECT j.user_id FROM account_deletion_jobs j
     WHERE NOT EXISTS (SELECT 1 FROM neon_auth."user" a WHERE a.id = j.user_id::uuid)
     ORDER BY j.created_at LIMIT 50`,
  );
  let failures = 0;

  for (const job of jobs) {
    try {
      await completeAccountDeletion(job.user_id);
    } catch {
      failures += 1;
      console.error("Account deletion cleanup failed; job retained for retry.");
    }
  }

  return { processed: jobs.length, failures };
}
