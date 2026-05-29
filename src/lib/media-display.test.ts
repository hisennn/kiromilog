import assert from "node:assert/strict";
import { test } from "node:test";

import { toSafeMediaDisplay } from "@/lib/media-display";

test("toSafeMediaDisplay hides blocked media details", () => {
  assert.deepEqual(
    toSafeMediaDisplay({
      isBlocked: true,
      title: "Sensitive title",
      imageUrl: "https://example.com/cover.jpg",
      blockedTitle: "NSFW content",
    }),
    {
      title: "NSFW content",
      imageUrl: null,
    },
  );
});

test("toSafeMediaDisplay preserves visible media details", () => {
  assert.deepEqual(
    toSafeMediaDisplay({
      isBlocked: false,
      title: "Visible title",
      imageUrl: "https://example.com/cover.jpg",
      blockedTitle: "NSFW content",
    }),
    {
      title: "Visible title",
      imageUrl: "https://example.com/cover.jpg",
    },
  );
});
