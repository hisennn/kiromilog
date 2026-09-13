import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, mock, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

const postgres = new PGlite();
const database = drizzle(postgres);

const query = async (sqlText: string, params?: unknown[]) =>
  (await postgres.query<Record<string, unknown>>(sqlText, params)).rows;

type TestSession = {
  session: { createdAt: Date };
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string | null;
    image: string | null;
  };
};

let currentSession: TestSession | null = null;

mock.module(new URL("./db/index.ts", import.meta.url).href, {
  namedExports: { db: database, sql: { query } },
});
mock.module(new URL("./auth/server.ts", import.meta.url).href, {
  namedExports: {
    getSession: async () => currentSession,
    requireVerifiedSession: async () => {
      if (!currentSession?.user) {
        throw new Error("REDIRECT:/auth/sign-in");
      }
      return currentSession;
    },
  },
});
mock.module("next/navigation", {
  namedExports: {
    redirect: (path: string) => {
      throw new Error(`REDIRECT:${path}`);
    },
  },
});

const { getViewerProfile } = await import("./viewer-profile");

const orphanOldId = "00000000-0000-4000-8000-000000000011";
const orphanNewId = "00000000-0000-4000-8000-000000000012";
const activeOldId = "00000000-0000-4000-8000-000000000021";
const activeNewId = "00000000-0000-4000-8000-000000000022";
const viewerId = "00000000-0000-4000-8000-000000000031";
const peerId = "00000000-0000-4000-8000-000000000032";

function sessionFor(
  id: string,
  email: string,
  name: string | null = "Test User",
): TestSession {
  return {
    session: { createdAt: new Date() },
    user: { id, email, emailVerified: true, name, image: null },
  };
}

before(async () => {
  const journal = JSON.parse(
    await readFile(
      new URL("../../drizzle/meta/_journal.json", import.meta.url),
      "utf8",
    ),
  );
  for (const entry of journal.entries) {
    await postgres.exec(
      await readFile(new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url), "utf8"),
    );
  }
  await postgres.exec(
    'CREATE SCHEMA IF NOT EXISTS neon_auth; CREATE TABLE IF NOT EXISTS neon_auth."user" (id uuid PRIMARY KEY)',
  );
});

beforeEach(async () => {
  currentSession = null;
  await postgres.exec('TRUNCATE users, neon_auth."user" CASCADE');
});

after(async () => {
  await postgres.close();
});

test("insert with orphaned email reclaims and creates new profile without 500", async () => {
  const email = "orphan@example.com";
  await postgres.query(
    "INSERT INTO users (id, email, username, nickname) VALUES ($1, $2, $3, $3)",
    [orphanOldId, email, "orphanold"],
  );
  await postgres.query('INSERT INTO neon_auth."user" (id) VALUES ($1)', [
    orphanNewId,
  ]);

  currentSession = sessionFor(orphanNewId, "  ORPHAN@Example.COM ", "Fresh User");

  const profile = await getViewerProfile();
  assert.equal(profile?.id, orphanNewId);
  assert.equal(profile?.email, email);

  const rows = await query("SELECT id, email FROM users");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, orphanNewId);
  assert.equal(rows[0].email, email);
});

test("insert with email of active account redirects instead of 500", async () => {
  const email = "active@example.com";
  await postgres.query(
    "INSERT INTO users (id, email, username, nickname) VALUES ($1, $2, $3, $3)",
    [activeOldId, email, "activeold"],
  );
  await postgres.query('INSERT INTO neon_auth."user" (id) VALUES ($1), ($2)', [
    activeOldId,
    activeNewId,
  ]);

  currentSession = sessionFor(activeNewId, email, "New User");

  await assert.rejects(getViewerProfile(), /REDIRECT:\/auth\/sign-in/);

  const rows = await query("SELECT id, email FROM users");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, activeOldId);
  assert.equal(rows[0].email, email);
});

test("update to another user's email keeps old email without 500", async () => {
  const viewerEmail = "viewer-update@example.com";
  const peerEmail = "peer-update@example.com";
  await postgres.query(
    "INSERT INTO users (id, email, username, nickname) VALUES ($1, $2, $3, $3), ($4, $5, $6, $6)",
    [viewerId, viewerEmail, "viewerupd", peerId, peerEmail, "peerupd"],
  );
  await postgres.query('INSERT INTO neon_auth."user" (id) VALUES ($1), ($2)', [
    viewerId,
    peerId,
  ]);

  currentSession = sessionFor(viewerId, peerEmail, "Viewer");

  const profile = await getViewerProfile();
  assert.equal(profile?.id, viewerId);
  assert.equal(profile?.email, viewerEmail);

  const rows = await query("SELECT id, email FROM users ORDER BY id");
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.email).sort(),
    [peerEmail, viewerEmail].sort(),
  );
});
