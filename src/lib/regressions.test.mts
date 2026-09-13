import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, mock, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

const postgres = new PGlite();
const database = drizzle(postgres);
const viewerId = "00000000-0000-4000-8000-000000000001";
const peerId = "00000000-0000-4000-8000-000000000002";
const threadId = "00000000-0000-4000-8000-000000000003";
const viewer = { id: viewerId, username: "viewer", nickname: "viewer", email: "viewer@example.com", bio: null, avatarPath: null };
let databaseUnavailable = false;
const query = async (sql: string, params?: unknown[]) => {
  if (databaseUnavailable) throw new Error("Database unavailable");
  return (await postgres.query(sql, params)).rows;
};
const trigger = mock.fn(async () => {});
const deleteFiles = mock.fn(async () => ({ success: true, deletedCount: 1 }));
const uploadFiles = mock.fn(async () => ({
  error: null, data: { ufsUrl: "https://test.ufs.sh/f/avatar", key: "avatar" },
}));
const deleteUser = mock.fn(async () => {
  await postgres.query('DELETE FROM neon_auth."user" WHERE id = $1', [viewerId]);
  return { error: null };
});

mock.module(new URL("./db/index.ts", import.meta.url).href, { namedExports: { db: database, sql: { query } } });
mock.module(new URL("./viewer-profile.ts", import.meta.url).href, { namedExports: { ensureViewerProfile: async () => viewer } });
mock.module(new URL("./pusher/server.ts", import.meta.url).href, { namedExports: { getPusherServer: () => ({ trigger }) } });
mock.module(new URL("./uploadthing.ts", import.meta.url).href, {
  namedExports: { utapi: { deleteFiles, uploadFiles }, isUploadThingConfigured: () => true },
});
mock.module(new URL("./auth/server.ts", import.meta.url).href, {
  namedExports: {
    auth: { deleteUser },
    getSession: async () => ({ user: { ...viewer, emailVerified: true } }),
    getSessionWithCookieMutation: async () => ({ user: { ...viewer, emailVerified: true } }),
  },
});
mock.module("next/headers", { namedExports: { headers: async () => new Headers(), cookies: async () => ({}) } });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });
mock.module("next/navigation", { namedExports: { redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } } });

const { consumeRateLimit } = await import("./rate-limit");
const { getThreadMessages } = await import("./chat");
const { sendChatMessageAction } = await import("./chat-actions");
const { uploadAvatarAction } = await import("./settings-actions");
const { completeAccountDeletion, prepareAccountDeletion, retryAccountDeletions } = await import("./account-deletion");
const { deleteAccountAction } = await import("./auth-actions");
const { GET: cleanupRoute } = await import("../app/api/cron/account-deletions/route");

before(async () => {
  const journal = JSON.parse(await readFile(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  for (const entry of journal.entries) {
    await postgres.exec(await readFile(new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url), "utf8"));
  }
  await postgres.exec('CREATE SCHEMA neon_auth; CREATE TABLE neon_auth."user" (id uuid PRIMARY KEY)');
});

beforeEach(async () => {
  databaseUnavailable = false;
  await postgres.exec('TRUNCATE users, rate_limit_buckets, account_deletion_jobs, neon_auth."user" CASCADE');
  await postgres.query('INSERT INTO users (id, email, username, nickname) VALUES ($1, $2, $3, $3), ($4, $5, $6, $6)',
    [viewerId, viewer.email, viewer.username, peerId, "peer@example.com", "peer"]);
  await postgres.query('INSERT INTO neon_auth."user" VALUES ($1), ($2)', [viewerId, peerId]);
  trigger.mock.resetCalls();
  trigger.mock.mockImplementation(async () => {});
  deleteFiles.mock.resetCalls();
  deleteFiles.mock.mockImplementation(async () => ({ success: true, deletedCount: 1 }));
  uploadFiles.mock.resetCalls();
  deleteUser.mock.resetCalls();
  deleteUser.mock.mockImplementation(async () => {
    await postgres.query('DELETE FROM neon_auth."user" WHERE id = $1', [viewerId]);
    return { error: null };
  });
});

after(async () => { await postgres.close(); });

test("rate limit permits exactly the limit and blocks all subsequent requests", async () => {
  const options = { key: "boundary", limit: 3, windowMs: 60_000 };
  const results = [];
  for (let i = 0; i < 6; i++) results.push((await consumeRateLimit(options)).allowed);
  assert.deepEqual(results, [true, true, true, false, false, false]);
});

test("rate limit remains atomic for simultaneous requests and resets after expiry", async () => {
  const options = { key: "concurrent", limit: 3, windowMs: 60_000 };
  const results = await Promise.all(Array.from({ length: 12 }, () => consumeRateLimit(options)));
  assert.equal(results.filter((result) => result.allowed).length, 3);
  await postgres.exec("UPDATE rate_limit_buckets SET reset_at = NOW() - INTERVAL '1 second'");
  const reset = await consumeRateLimit(options);
  assert.equal(reset.allowed, true);
  assert.equal(reset.remaining, 2);
});

test("auth limits fail closed and optional memory fallback also blocks", async () => {
  databaseUnavailable = true;
  assert.equal((await consumeRateLimit({ key: "auth", limit: 2, windowMs: 60_000, failClosed: true })).allowed, false);
  const options = { key: "memory", limit: 1, windowMs: 60_000 };
  assert.equal((await consumeRateLimit(options)).allowed, true);
  assert.equal((await consumeRateLimit(options)).allowed, false);
});

async function seedThread() {
  await postgres.query('INSERT INTO chat_threads (id, participant_a_id, participant_b_id) VALUES ($1, $2, $3)', [threadId, viewerId, peerId]);
  await postgres.query('INSERT INTO user_follows VALUES ($1, $2), ($2, $1)', [viewerId, peerId]);
}

test("chat loads the latest 100 messages chronologically and respects per-user clearing", async () => {
  await seedThread();
  await postgres.query(`INSERT INTO chat_messages (thread_id, sender_id, body, created_at)
    SELECT $1, $2, n::text, '2026-01-01'::timestamptz + n * INTERVAL '1 second'
    FROM generate_series(1, 105) n`, [threadId, viewerId]);
  const messages = await getThreadMessages(threadId, viewerId);
  assert.equal(messages.length, 100);
  assert.equal(messages[0].body, "6");
  assert.equal(messages.at(-1)?.body, "105");
  await postgres.query(`INSERT INTO chat_thread_clears VALUES ($1, $2, '2026-01-01'::timestamptz + INTERVAL '103 seconds')`, [threadId, viewerId]);
  assert.deepEqual((await getThreadMessages(threadId, viewerId)).map((message) => message.body), ["104", "105"]);
  assert.equal((await getThreadMessages(threadId, peerId)).length, 100);
});

test("a Pusher failure does not turn a saved message into a failed send", async () => {
  await seedThread();
  trigger.mock.mockImplementation(async () => { throw new Error("Pusher unavailable"); });
  const form = new FormData();
  form.set("threadId", threadId);
  form.set("body", "Hello");
  const result = await sendChatMessageAction(form);
  assert.equal(result.ok, true);
  assert.equal(trigger.mock.callCount(), 2);
  assert.equal((await getThreadMessages(threadId, viewerId)).length, 1);
});

function avatar(size: number) {
  const bytes = Buffer.alloc(size);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12);
  bytes.writeUInt32BE(32, 16);
  bytes.writeUInt32BE(32, 20);
  const form = new FormData();
  form.set("avatar", new File([bytes], "avatar.png", { type: "image/png" }));
  return form;
}

test("avatar allows exactly 1 MB and rejects one extra byte before uploading", async () => {
  assert.equal((await uploadAvatarAction(avatar(1024 * 1024))).ok, true);
  const result = await uploadAvatarAction(avatar(1024 * 1024 + 1));
  assert.equal(result.ok, false);
  assert.equal(uploadFiles.mock.callCount(), 1);
});

test("pending deletion cannot remove a still-active Auth identity", async () => {
  await prepareAccountDeletion(viewerId);
  await completeAccountDeletion(viewerId);
  assert.equal((await query("SELECT id FROM users WHERE id = $1", [viewerId])).length, 1);
  assert.deepEqual(await retryAccountDeletions(), { processed: 0, failures: 0 });
});

test("account deletion cascades local data and completes its durable job", async () => {
  await seedThread();
  await assert.rejects(deleteAccountAction(), /REDIRECT:\//);
  assert.equal(deleteUser.mock.callCount(), 1);
  assert.equal((await query("SELECT id FROM users WHERE id = $1", [viewerId])).length, 0);
  assert.equal((await query("SELECT id FROM chat_threads")).length, 0);
  assert.equal((await query("SELECT * FROM account_deletion_jobs")).length, 0);
});

test("cleanup retries after Auth succeeded but the response was lost", async () => {
  deleteUser.mock.mockImplementation(async () => {
    await postgres.query('DELETE FROM neon_auth."user" WHERE id = $1', [viewerId]);
    throw new Error("Response lost");
  });
  assert.equal((await deleteAccountAction()).ok, false);
  assert.equal((await query("SELECT * FROM account_deletion_jobs")).length, 1);
  assert.deepEqual(await retryAccountDeletions(), { processed: 1, failures: 0 });
  assert.equal((await query("SELECT id FROM users WHERE id = $1", [viewerId])).length, 0);
});

test("Auth is not called if the durable deletion job cannot be written", async () => {
  await postgres.exec(`CREATE FUNCTION reject_job() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Job storage unavailable'; END $$;
    CREATE TRIGGER reject_job BEFORE INSERT ON account_deletion_jobs FOR EACH ROW EXECUTE FUNCTION reject_job()`);
  try {
    assert.equal((await deleteAccountAction()).ok, false);
    assert.equal(deleteUser.mock.callCount(), 0);
    assert.equal((await query('SELECT id FROM neon_auth."user" WHERE id = $1', [viewerId])).length, 1);
  } finally {
    await postgres.exec("DROP TRIGGER reject_job ON account_deletion_jobs; DROP FUNCTION reject_job()");
  }
});

test("a database cleanup failure after Auth deletion is retried from the saved job", async () => {
  await postgres.exec(`CREATE FUNCTION reject_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Cleanup unavailable'; END $$;
    CREATE TRIGGER reject_cleanup BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION reject_cleanup()`);
  try {
    await assert.rejects(deleteAccountAction(), /REDIRECT:\//);
    assert.equal((await query('SELECT id FROM neon_auth."user" WHERE id = $1', [viewerId])).length, 0);
    assert.equal((await query("SELECT id FROM users WHERE id = $1", [viewerId])).length, 1);
    assert.equal((await query("SELECT * FROM account_deletion_jobs")).length, 1);
  } finally {
    await postgres.exec("DROP TRIGGER reject_cleanup ON users; DROP FUNCTION reject_cleanup()");
  }
  assert.deepEqual(await retryAccountDeletions(), { processed: 1, failures: 0 });
  assert.equal((await query("SELECT id FROM users WHERE id = $1", [viewerId])).length, 0);
});

test("failed avatar cleanup retains the file key and retries idempotently", async () => {
  await postgres.query("UPDATE users SET avatar_path = 'uploadthing:old-avatar' WHERE id = $1", [viewerId]);
  await prepareAccountDeletion(viewerId);
  await postgres.query('DELETE FROM neon_auth."user" WHERE id = $1', [viewerId]);
  deleteFiles.mock.mockImplementation(async () => ({ success: false, deletedCount: 0 }));
  await assert.rejects(completeAccountDeletion(viewerId), /avatar cleanup/);
  assert.equal((await query("SELECT * FROM account_deletion_jobs")).length, 1);
  deleteFiles.mock.mockImplementation(async () => ({ success: true, deletedCount: 1 }));
  await completeAccountDeletion(viewerId);
  await completeAccountDeletion(viewerId);
  assert.equal((await query("SELECT * FROM account_deletion_jobs")).length, 0);
  assert.deepEqual(deleteFiles.mock.calls.map((call) => call.arguments), [["old-avatar"], ["old-avatar"]]);
});

test("cleanup endpoint rejects missing configuration and incorrect credentials", async () => {
  const original = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await cleanupRoute(new Request("https://example.com"))).status, 401);
    process.env.CRON_SECRET = "test-secret";
    assert.equal((await cleanupRoute(new Request("https://example.com"))).status, 401);
    assert.equal((await cleanupRoute(new Request("https://example.com", { headers: { authorization: "Bearer test-secret" } }))).status, 200);
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  }
});
