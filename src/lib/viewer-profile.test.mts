import assert from "node:assert/strict";
import { mock, test } from "node:test";

const cachedUser = { id: "deleted-user", email: "deleted@example.com", emailVerified: true };
const getSession = mock.fn(async (options?: { disableCookieCache?: boolean }) =>
  options?.disableCookieCache ? null : { user: cachedUser },
);
const insert = mock.fn(() => { throw new Error("A deleted profile must not be recreated"); });

mock.module(new URL("./db/index.ts", import.meta.url).href, {
  namedExports: {
    db: {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
      insert,
    },
  },
});
mock.module(new URL("./auth/server.ts", import.meta.url).href, {
  namedExports: { getSession, requireVerifiedSession: async () => ({ user: cachedUser }) },
});
mock.module("next/navigation", {
  namedExports: { redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } },
});

const { getViewerProfile, ensureViewerProfile } = await import("./viewer-profile");

test("a cached session cannot recreate a deleted profile during page rendering", async () => {
  await assert.rejects(getViewerProfile(), /REDIRECT:\/auth\/sign-in/);
  assert.equal(insert.mock.callCount(), 0);
  assert.deepEqual(getSession.mock.calls.at(-1)?.arguments, [{ disableCookieCache: true }]);
});

test("a cached session cannot recreate a deleted profile from a server action", async () => {
  await assert.rejects(ensureViewerProfile({ allowCookieMutation: true }), /REDIRECT:\/auth\/sign-in/);
  assert.equal(insert.mock.callCount(), 0);
});
