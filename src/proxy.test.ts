import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

test("proxy keeps a restrictive CSP when Auth configuration is missing", () => {
  const original = process.env.NEON_AUTH_BASE_URL;
  try {
    delete process.env.NEON_AUTH_BASE_URL;
    const first = proxy(new NextRequest("https://example.com"));
    const second = proxy(new NextRequest("https://example.com"));
    const csp = first.headers.get("Content-Security-Policy");
    assert.ok(csp?.includes("'strict-dynamic'"));
    assert.equal(first.headers.get("x-middleware-request-content-security-policy"), csp);
    assert.notEqual(second.headers.get("Content-Security-Policy"), csp);
    assert.equal(first.status, 200);
  } finally {
    if (original === undefined) delete process.env.NEON_AUTH_BASE_URL;
    else process.env.NEON_AUTH_BASE_URL = original;
  }
});
