import assert from "node:assert/strict";
import { test } from "node:test";

test("env module can be imported without reading environment values", async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  delete process.env.DATABASE_URL;

  try {
    const mod = await import("@/lib/env");
    assert.equal(typeof mod.getEnv, "function");
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
});
