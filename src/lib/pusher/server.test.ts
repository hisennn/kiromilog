import assert from "node:assert/strict";
import { test } from "node:test";
import Pusher from "pusher";

test("patched Pusher URL constructor preserves configuration and channel signing", () => {
  const fromUrl = Pusher.forURL("https://key:secret@api.example.com/apps/123");
  const direct = new Pusher({ appId: "123", key: "key", secret: "secret", host: "api.example.com", useTLS: true });
  assert.deepEqual(fromUrl.authorizeChannel("123.456", "private-test"), direct.authorizeChannel("123.456", "private-test"));
  assert.throws(() => fromUrl.authorizeChannel("invalid", "private-test"));
});
