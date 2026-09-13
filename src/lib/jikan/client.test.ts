import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { searchMediaPage } from "./client";

afterEach(() => mock.restoreAll());

test("catalog falls back on a provider-specific 404", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));
  fetch.mock.mockImplementationOnce(async () => Response.json({ data: [], pagination: { current_page: 1, last_visible_page: 1, has_next_page: false } }), 1);
  assert.deepEqual((await searchMediaPage("example", "anime")).items, []);
  assert.equal(fetch.mock.callCount(), 2);
});

test("catalog does not retry an invalid request on a second provider", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => new Response(null, { status: 400 }));
  await assert.rejects(searchMediaPage("example", "anime"));
  assert.equal(fetch.mock.callCount(), 1);
});
