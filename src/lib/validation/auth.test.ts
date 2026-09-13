import assert from "node:assert/strict";
import { test } from "node:test";
import { signInSchema, signUpSchema, requestPasswordResetSchema } from "./auth";

test("email schemas normalize before validation", () => {
  const email = "  Person@Example.COM  ";
  assert.equal(signInSchema.parse({ email, password: "password1" }).email, "person@example.com");
  assert.equal(signUpSchema.parse({ email, password: "password1", nickname: "person" }).email, "person@example.com");
  assert.equal(requestPasswordResetSchema.parse({ email }).email, "person@example.com");
});
