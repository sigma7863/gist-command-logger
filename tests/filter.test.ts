import { test, expect } from "bun:test";
import { createFilter } from "../src/filter";

test("deny rules override allow rules", () => {
  const filter = createFilter({
    allow: [".*"],
    deny: ["^git status$"]
  });

  expect(filter.matches("brew install gh")).toBe(true);
  expect(filter.matches("git status")).toBe(false);
});

test("allow list restricts commands", () => {
  const filter = createFilter({
    allow: ["^brew install", "^npm i"],
    deny: []
  });

  expect(filter.matches("brew install jq")).toBe(true);
  expect(filter.matches("npm i lodash")).toBe(true);
  expect(filter.matches("pip install requests")).toBe(false);
});
