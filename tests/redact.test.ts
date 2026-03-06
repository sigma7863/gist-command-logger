import { test, expect } from "bun:test";
import { redactSecrets } from "../src/redact";

test("redacts common flag secrets", () => {
  const line = "curl -H 'Authorization: Bearer sk-abc123456789012345678' --token=abc123 --password hunter2";
  const redacted = redactSecrets(line);

  expect(redacted.includes("hunter2")).toBe(false);
  expect(redacted.includes("abc123")).toBe(false);
  expect(redacted.includes("[REDACTED]")).toBe(true);
});

test("redacts URL credentials", () => {
  const line = "git clone https://user:supersecret@example.com/repo.git";
  const redacted = redactSecrets(line);

  expect(redacted.includes("supersecret")).toBe(false);
  expect(redacted).toContain("https://user:[REDACTED]@example.com");
});
