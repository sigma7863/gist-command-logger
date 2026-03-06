import test from "node:test";
import assert from "node:assert/strict";
import { redactSecrets } from "../src/redact.js";

test("redacts common flag secrets", () => {
  const line = "curl -H 'Authorization: Bearer sk-abc123456789012345678' --token=abc123 --password hunter2";
  const redacted = redactSecrets(line);

  assert.equal(redacted.includes("hunter2"), false);
  assert.equal(redacted.includes("abc123"), false);
  assert.match(redacted, /\[REDACTED\]/);
});

test("redacts URL credentials", () => {
  const line = "git clone https://user:supersecret@example.com/repo.git";
  const redacted = redactSecrets(line);

  assert.equal(redacted.includes("supersecret"), false);
  assert.match(redacted, /https:\/\/user:\[REDACTED\]@example.com/);
});
