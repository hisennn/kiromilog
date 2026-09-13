import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, mock, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import Pusher from "pusher";

const postgres = new PGlite();
const database = drizzle(postgres);
mock.module(new URL("./db/transaction.ts", import.meta.url).href, { namedExports: { withTransaction: (operation: Parameters<typeof database.transaction>[0]) => database.transaction(operation) } });
const viewerId = "00000000-0000-4000-8000-000000000001";
const peerId = "00000000-0000-4000-8000-000000000002";
const threadId = "00000000-0000-4000-8000-000000000003";
const viewer = { id: viewerId, username: "viewer", nickname: "viewer", email: "viewer@example.com", bio: null, avatarPath: null };
let databaseUnavailable = false;
const query = async (sql: string, params?: unknown[]) => {
  if (databaseUnavailable) throw new Error("Database unavailable");
  return (await postgres.query<Record<string, unknown>>(sql, params)).rows;
};
let pusherConfigured = true;
const signingPusher = new Pusher({ appId: "test", key: "test", secret: "test", cluster: "mt1" });
const trigger = mock.fn(async () => {});
const deleteFiles = mock.fn(async () => ({ success: true, deletedCount: 1 }));
const uploadFiles = mock.fn(async () => ({
  error: null, data: { ufsUrl: "https://test.ufs.sh/f/avatar", key: "avatar" },
}));
let authError = false;
let emailVerified = true;
let credentialAccount = true;
let sessionCreatedAt = new Date();
const cookieValues = new Map<string, string>();
const sendVerificationOtp = mock.fn(async () => ({ error: authError ? { message: "Unavailable" } : null }));
const verifyEmail = mock.fn(async () => ({ error: authError ? { message: "Invalid code" } : null }));
const resetPassword = mock.fn(async () => ({ error: authError ? { message: "Invalid token" } : null }));
const changePassword = mock.fn(async () => ({ error: authError ? { message: "Invalid password" } : null }));
const deleteUser = mock.fn(async () => {
  await postgres.query('DELETE FROM neon_auth."user" WHERE id = $1', [viewerId]);
  return { error: null };
});

mock.module(new URL("./db/index.ts", import.meta.url).href, { namedExports: { db: database, sql: { query } } });
mock.module(new URL("./viewer-profile.ts", import.meta.url).href, { namedExports: { ensureViewerProfile: async () => viewer } });
mock.module(new URL("./pusher/server.ts", import.meta.url).href, { namedExports: { getPusherServer: () => pusherConfigured ? ({ trigger, authorizeChannel: signingPusher.authorizeChannel.bind(signingPusher) }) : null } });
mock.module(new URL("./uploadthing.ts", import.meta.url).href, {
  namedExports: { utapi: { deleteFiles, uploadFiles }, isUploadThingConfigured: () => true },
});
mock.module(new URL("./auth/server.ts", import.meta.url).href, {
  namedExports: {
    auth: { deleteUser, resetPassword, changePassword, emailOtp: { sendVerificationOtp, verifyEmail }, listAccounts: async () => ({ data: [{ providerId: credentialAccount ? "credential" : "google" }], error: null }) },
    getSession: async () => ({ session: { createdAt: sessionCreatedAt }, user: { ...viewer, emailVerified } }),
    getSessionWithCookieMutation: async () => ({ user: { ...viewer, emailVerified: true } }),
  },
});
mock.module("next/headers", { namedExports: { headers: async () => new Headers(), cookies: async () => ({ get: (name: string) => cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined, set: ({ name, value }: { name: string; value: string }) => cookieValues.set(name, value), delete: (name: string) => cookieValues.delete(name) }) } });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });
mock.module("next/navigation", { namedExports: { redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } } });

const { consumeRateLimit, getClientIpFromHeaders } = await import("./rate-limit");
const { getThreadMessages, getViewerThreads } = await import("./chat");
const { sendChatMessageAction } = await import("./chat-actions");
const { uploadAvatarAction, updateBioAction } = await import("./settings-actions");
const { completeAccountDeletion, prepareAccountDeletion, retryAccountDeletions } = await import("./account-deletion");
const { deleteAccountAction, resetPasswordAction, changePasswordAction, verifyEmailCodeAction, resendVerificationEmailAction } = await import("./auth-actions");
const { POST: authorizeChannel } = await import("../app/api/pusher/auth/route");
const { toggleActivityLikeAction } = await import("./activity-like-actions");
const { saveAnimeEntryAction, toggleFavoriteAnimeAction, saveFavoriteAnimeOrderAction } = await import("./library-actions");
const { getProfileLibrary, getProfileLibrarySummary } = await import("./feed");
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
  pusherConfigured = true;
  authError = false;
  emailVerified = true;
  credentialAccount = true;
  sessionCreatedAt = new Date();
  cookieValues.clear();
  sendVerificationOtp.mock.resetCalls();
  verifyEmail.mock.resetCalls();
  resetPassword.mock.resetCalls();
  changePassword.mock.resetCalls();
  await postgres.exec('TRUNCATE users, anime_cache, manga_cache, character_cache, rate_limit_buckets, account_deletion_jobs, neon_auth."user" CASCADE');
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

function deletionForm() {
  const form = new FormData();
  form.set("username", viewer.username);
  form.set("currentPassword", "test-password");
  return form;
}

test("account deletion cascades local data and completes its durable job", async () => {
  await seedThread();
  await assert.rejects(deleteAccountAction(deletionForm()), /REDIRECT:\//);
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
  assert.equal((await deleteAccountAction(deletionForm())).ok, false);
  assert.equal((await query("SELECT * FROM account_deletion_jobs")).length, 1);
  assert.deepEqual(await retryAccountDeletions(), { processed: 1, failures: 0 });
  assert.equal((await query("SELECT id FROM users WHERE id = $1", [viewerId])).length, 0);
});

test("Auth is not called if the durable deletion job cannot be written", async () => {
  await postgres.exec(`CREATE FUNCTION reject_job() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Job storage unavailable'; END $$;
    CREATE TRIGGER reject_job BEFORE INSERT ON account_deletion_jobs FOR EACH ROW EXECUTE FUNCTION reject_job()`);
  try {
    assert.equal((await deleteAccountAction(deletionForm())).ok, false);
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
    await assert.rejects(deleteAccountAction(deletionForm()), /REDIRECT:\//);
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
    process.env.CRON_SECRET = "test-secret-that-is-at-least-32-characters";
    assert.equal((await cleanupRoute(new Request("https://example.com"))).status, 401);
    assert.equal((await cleanupRoute(new Request("https://example.com", { headers: { authorization: "Bearer test-secret-that-is-at-least-32-characters" } }))).status, 200);
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  }
});


test("client IP ignores spoofed proxy headers and malformed Vercel addresses", () => {
  const original = process.env.VERCEL;
  try {
    process.env.VERCEL = "1";
    assert.equal(getClientIpFromHeaders(new Headers({ "x-vercel-forwarded-for": "203.0.113.1", "cf-connecting-ip": "1.1.1.1", "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3, 4.4.4.4" })), "203.0.113.1");
    assert.equal(getClientIpFromHeaders(new Headers({ "x-vercel-forwarded-for": "1.1.1.1, 2.2.2.2" })), "unknown");
    assert.equal(getClientIpFromHeaders(new Headers()), "unknown");
    delete process.env.VERCEL;
    assert.equal(getClientIpFromHeaders(new Headers({ "x-vercel-forwarded-for": "203.0.113.1" })), "unknown");
  } finally {
    if (original === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = original;
  }
});

test("account deletion requires matching username and a credential password", async () => {
  const form = deletionForm();
  form.set("username", "peer");
  assert.equal((await deleteAccountAction(form)).ok, false);
  form.set("username", viewer.username);
  form.set("currentPassword", "");
  assert.equal((await deleteAccountAction(form)).ok, false);
  assert.equal(deleteUser.mock.callCount(), 0);
  assert.equal((await query("SELECT * FROM account_deletion_jobs")).length, 0);
});

test("chat commits on partial Pusher failure and without Pusher", async () => {
  await seedThread();
  trigger.mock.mockImplementation(async (channel?: string) => { if (channel?.startsWith("private-chat")) throw new Error("Unavailable"); });
  const form = new FormData();
  form.set("threadId", threadId); form.set("body", "Hello");
  assert.equal((await sendChatMessageAction(form)).ok, true);
  pusherConfigured = false;
  assert.equal((await sendChatMessageAction(form)).ok, true);
  assert.equal((await getThreadMessages(threadId, viewerId)).length, 2);
});

test("chat rolls back the message when the thread update fails", async () => {
  await seedThread();
  await postgres.exec(`CREATE FUNCTION reject_thread_update() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Update unavailable'; END $$;
    CREATE TRIGGER reject_thread_update BEFORE UPDATE ON chat_threads FOR EACH ROW EXECUTE FUNCTION reject_thread_update()`);
  try {
    const form = new FormData(); form.set("threadId", threadId); form.set("body", "Hello");
    await assert.rejects(sendChatMessageAction(form));
    assert.equal((await getThreadMessages(threadId, viewerId)).length, 0);
    assert.equal(trigger.mock.callCount(), 0);
  } finally {
    await postgres.exec("DROP TRIGGER reject_thread_update ON chat_threads; DROP FUNCTION reject_thread_update()");
  }
});

test("bio trims text, rejects oversized input, and accepts the boundary", async () => {
  const form = new FormData(); form.set("bio", "  Hello  ");
  assert.deepEqual(await updateBioAction(form), { ok: true, bio: "Hello" });
  form.set("bio", "x".repeat(281)); assert.equal((await updateBioAction(form)).ok, false);
  form.set("bio", "x".repeat(280)); assert.equal((await updateBioAction(form)).ok, true);
});

test("avatar rejects oversized dimensions and disguised GIF before uploading", async () => {
  const form = avatar(64);
  const file = form.get("avatar") as File;
  const bytes = Buffer.from(await file.arrayBuffer()); bytes.writeUInt32BE(2049, 16);
  form.set("avatar", new File([bytes], "avatar.png", { type: "image/png" }));
  assert.equal((await uploadAvatarAction(form)).ok, false);
  form.set("avatar", new File(["GIF89a"], "avatar.png", { type: "image/png" }));
  assert.equal((await uploadAvatarAction(form)).ok, false);
  assert.equal(uploadFiles.mock.callCount(), 0);
});

test("cron returns 500 on database failure and purges only expired buckets", async () => {
  const original = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "test-secret-that-is-at-least-32-characters";
    const request = () => new Request("https://example.com", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    await consumeRateLimit({ key: "active", limit: 1, windowMs: 60000 });
    await postgres.exec("INSERT INTO rate_limit_buckets (key, reset_at) VALUES ('expired', NOW() - INTERVAL '1 second')");
    assert.equal((await cleanupRoute(request())).status, 200);
    assert.deepEqual((await query("SELECT key FROM rate_limit_buckets")).map((r) => r.key), ["active"]);
    databaseUnavailable = true;
    assert.equal((await cleanupRoute(request())).status, 500);
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  }
});


test("Pusher authorization validates origin, socket, UUID, ownership and availability", async () => {
  await seedThread();
  const request = (channel: string, socket = "123.456", origin = "https://example.com") => new Request("https://example.com/api/pusher/auth", {
    method: "POST", headers: { origin }, body: new URLSearchParams({ channel_name: channel, socket_id: socket }),
  });
  assert.equal((await authorizeChannel(request(`private-user-${viewerId}`))).status, 200);
  assert.equal((await authorizeChannel(request(`private-chat-${threadId}`))).status, 200);
  assert.equal((await authorizeChannel(request(`private-user-${peerId}`))).status, 400);
  assert.equal((await authorizeChannel(request(`private-chat-${threadId}`, "invalid"))).status, 400);
  assert.equal((await authorizeChannel(request("private-chat-invalid"))).status, 400);
  assert.equal((await authorizeChannel(request(`private-chat-${threadId}`, "123.456", "https://attacker.example"))).status, 403);
  assert.equal((await authorizeChannel(request("private-chat-00000000-0000-4000-8000-000000000099"))).status, 403);
  pusherConfigured = false;
  assert.equal((await authorizeChannel(request(`private-user-${viewerId}`))).status, 503);
});

test("password actions reject invalid inputs, propagate provider errors and revoke other sessions", async () => {
  const form = new FormData(); form.set("newPassword", "valid-password1");
  form.set("token", "x".repeat(513));
  assert.ok((await resetPasswordAction({}, form)).error);
  assert.equal(resetPassword.mock.callCount(), 0);
  form.set("token", "valid-token"); authError = true;
  assert.ok((await resetPasswordAction({}, form)).error);
  form.set("currentPassword", "");
  assert.ok((await changePasswordAction({}, form)).error);
  assert.equal(changePassword.mock.callCount(), 0);
  form.set("currentPassword", "old-password");
  assert.ok((await changePasswordAction({}, form)).error);
  authError = false;
  assert.ok((await changePasswordAction({}, form)).success);
  assert.deepEqual(changePassword.mock.calls.at(-1)?.arguments, [{ currentPassword: "old-password", newPassword: "valid-password1", revokeOtherSessions: true }]);
  await assert.rejects(resetPasswordAction({}, form), /REDIRECT/);
  const rows = await query("SELECT key FROM rate_limit_buckets");
  assert.equal(rows.some((row) => String(row.key).includes("valid-token")), false);
});

test("likes commit without Pusher and roll back if notification storage fails", async () => {
  const [activity] = await query("INSERT INTO activities (actor_id, kind, media_kind, media_mal_id, payload) VALUES ($1, 'anime_status', 'anime', 1, '{}') RETURNING id", [peerId]);
  const form = new FormData(); form.set("activityId", String(activity.id));
  trigger.mock.mockImplementation(async () => { throw new Error("Unavailable"); });
  assert.deepEqual(await toggleActivityLikeAction(form), { ok: true, liked: true, likeCount: 1 });
  pusherConfigured = false;
  assert.deepEqual(await toggleActivityLikeAction(form), { ok: true, liked: false, likeCount: 0 });
  await postgres.exec("TRUNCATE activity_like_notifications CASCADE");
  await postgres.exec(`CREATE FUNCTION reject_notification() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Notification unavailable'; END $$;
    CREATE TRIGGER reject_notification BEFORE INSERT ON activity_like_notifications FOR EACH ROW EXECUTE FUNCTION reject_notification()`);
  try {
    await assert.rejects(toggleActivityLikeAction(form));
    assert.equal((await query("SELECT * FROM activity_likes")).length, 0);
  } finally {
    await postgres.exec("DROP TRIGGER reject_notification ON activity_like_notifications; DROP FUNCTION reject_notification()");
  }
});

async function seedCatalog() {
  await postgres.exec(`INSERT INTO anime_cache (mal_id, title, payload) SELECT n, 'Title ' || n, '{"episodes":12}'::jsonb FROM generate_series(1, 60) n ON CONFLICT DO NOTHING`);
}

test("favorites enforce the limit and preserve positions across add, remove and reorder", async () => {
  await seedCatalog();
  const form = (id: number) => { const data = new FormData(); data.set("malId", String(id)); return data; };
  const results = await Promise.all(Array.from({ length: 10 }, (_, index) => toggleFavoriteAnimeAction(form(index + 1))));
  assert.equal(results.filter((result) => result.ok).length, 9);
  const rows = await query("SELECT id, mal_id FROM favorite_anime ORDER BY position");
  assert.equal(await saveFavoriteAnimeOrderAction(rows.map((row) => String(row.id)).reverse()), true);
  assert.equal((await toggleFavoriteAnimeAction(form(Number(rows[4].mal_id)))).ok, true);
  assert.deepEqual((await query("SELECT position FROM favorite_anime ORDER BY position")).map((r) => r.position), [1,2,3,4,5,6,7,8]);
});

test("library entry and activities roll back together", async () => {
  await seedCatalog();
  await postgres.exec(`CREATE FUNCTION reject_activity() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Activity unavailable'; END $$;
    CREATE TRIGGER reject_activity BEFORE INSERT ON activities FOR EACH ROW EXECUTE FUNCTION reject_activity()`);
  try {
    const form = new FormData(); form.set("malId", "1"); form.set("status", "watching"); form.set("progressEpisodes", "1");
    await assert.rejects(saveAnimeEntryAction(form));
    assert.equal((await query("SELECT * FROM user_anime_list")).length, 0);
  } finally {
    await postgres.exec("DROP TRIGGER reject_activity ON activities; DROP FUNCTION reject_activity()");
  }
});

test("library pagination projects only display fields and summaries cover every page", async () => {
  await seedCatalog();
  await postgres.query(`INSERT INTO user_anime_list (user_id, mal_id, status, score) SELECT $1, n, 'completed', 8 FROM generate_series(1,60) n`, [viewerId]);
  const first = await getProfileLibrary(viewerId, "anime", { page: 1, filter: "all" });
  const second = await getProfileLibrary(viewerId, "anime", { page: 2, filter: "all" });
  assert.equal(first.length, 51); assert.equal(second.length, 10);
  assert.equal(new Set([...first.slice(0,50), ...second].map((r) => r.id)).size, 60);
  assert.deepEqual(await getProfileLibrarySummary(viewerId, "anime", false), { average: "8.0", progress: 720 });
  await postgres.exec("UPDATE anime_cache SET is_explicit = true WHERE mal_id = 1");
  assert.deepEqual(await getProfileLibrarySummary(viewerId, "anime", false), { average: "8.0", progress: 708 });
  assert.equal((await getProfileLibrary(viewerId, "anime", { page: 1, filter: "watching" })).length, 0);
});

test("thread list paginates without duplicates when timestamps tie", async () => {
  await postgres.query(`INSERT INTO users (id, email, username, nickname) SELECT 'peer-' || n, 'peer-' || n || '@example.com', 'peer-' || n, 'Peer' FROM generate_series(1,55) n`);
  await postgres.query(`INSERT INTO chat_threads (participant_a_id, participant_b_id) SELECT $1, 'peer-' || n FROM generate_series(1,55) n`, [viewerId]);
  const first = await getViewerThreads(viewerId);
  const second = await getViewerThreads(viewerId, 2);
  assert.equal(first.items.length, 50); assert.equal(first.hasMore, true);
  assert.equal(second.items.length, 5); assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.items, ...second.items].map((r) => r.thread.id)).size, 55);
});


test("avatar upload failure preserves the previous profile and failed persistence cleans the new file", async () => {
  uploadFiles.mock.mockImplementationOnce(async () => { throw new Error("UploadThing unavailable"); });
  await assert.rejects(uploadAvatarAction(avatar(64)));
  assert.equal((await query("SELECT avatar_path FROM users WHERE id = $1", [viewerId]))[0].avatar_path, null);
  await postgres.exec(`CREATE FUNCTION reject_avatar() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Profile update unavailable'; END $$;
    CREATE TRIGGER reject_avatar BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION reject_avatar()`);
  try {
    assert.equal((await uploadAvatarAction(avatar(64))).ok, false);
    assert.deepEqual(deleteFiles.mock.calls.at(-1)?.arguments, ["avatar"]);
  } finally {
    await postgres.exec("DROP TRIGGER reject_avatar ON users; DROP FUNCTION reject_avatar()");
  }
});

test("email backfill rejects collisions instead of combining profiles", async () => {
  const migration = await readFile(new URL("../../drizzle/0012_normalize_profile_emails.sql", import.meta.url), "utf8");
  await postgres.query("UPDATE users SET email = ' VIEWER@EXAMPLE.COM ' WHERE id = $1", [viewerId]);
  await postgres.exec(migration);
  assert.equal((await query("SELECT email FROM users WHERE id = $1", [viewerId]))[0].email, viewer.email);
  await postgres.query("UPDATE users SET email = 'VIEWER@EXAMPLE.COM' WHERE id = $1", [peerId]);
  await assert.rejects(postgres.exec(migration), /duplicate normalized profile emails/);
});


test("verification normalizes email, validates codes and respects resend cooldown", async () => {
  emailVerified = false;
  const form = new FormData(); form.set("email", " VIEWER@EXAMPLE.COM "); form.set("otp", "bad");
  assert.ok((await verifyEmailCodeAction({}, form)).error);
  assert.equal(verifyEmail.mock.callCount(), 0);
  assert.ok((await resendVerificationEmailAction({}, form)).success);
  assert.deepEqual(sendVerificationOtp.mock.calls.at(-1)?.arguments, [{ email: viewer.email, type: "email-verification" }]);
  assert.ok((await resendVerificationEmailAction({}, form)).cooldownSeconds);
  assert.equal(sendVerificationOtp.mock.callCount(), 1);
  form.set("otp", "123456"); authError = true;
  assert.ok((await verifyEmailCodeAction({}, form)).error);
  authError = false;
  await assert.rejects(verifyEmailCodeAction({}, form), /REDIRECT/);
});

test("password reset has an IP-wide budget even across different tokens", async () => {
  const form = new FormData(); form.set("newPassword", "password123"); authError = true;
  for (let index = 0; index < 31; index++) {
    form.set("token", `token-${index}`);
    await resetPasswordAction({}, form);
  }
  assert.equal(resetPassword.mock.callCount(), 30);
});

test("OAuth deletion requires a recent sign-in without requiring a password", async () => {
  credentialAccount = false;
  const form = deletionForm(); form.set("currentPassword", "");
  sessionCreatedAt = new Date(Date.now() - 11 * 60 * 1000);
  assert.equal((await deleteAccountAction(form)).ok, false);
  assert.equal(deleteUser.mock.callCount(), 0);
  sessionCreatedAt = new Date();
  await assert.rejects(deleteAccountAction(form), /REDIRECT/);
});

test("Pusher authorization rejects an unverified session", async () => {
  emailVerified = false;
  const request = new Request("https://example.com/api/pusher/auth", { method: "POST", headers: { origin: "https://example.com" }, body: new URLSearchParams({ socket_id: "123.456", channel_name: `private-user-${viewerId}` }) });
  assert.equal((await authorizeChannel(request)).status, 401);
});


test("cron removes only old abandoned deletion attempts for active accounts", async () => {
  await prepareAccountDeletion(viewerId);
  await prepareAccountDeletion(peerId);
  await postgres.query("UPDATE account_deletion_jobs SET created_at = NOW() - INTERVAL '2 days' WHERE user_id = $1", [peerId]);
  assert.deepEqual(await retryAccountDeletions(), { processed: 0, failures: 0 });
  assert.deepEqual((await query("SELECT user_id FROM account_deletion_jobs")).map((row) => row.user_id), [viewerId]);
  assert.equal((await query("SELECT id FROM users")).length, 2);
});
