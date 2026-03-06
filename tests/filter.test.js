import test from "node:test";
import assert from "node:assert/strict";
import { createFilter } from "../src/filter.js";

test("deny rules override allow rules", () => {
  const filter = createFilter({
    allow: [".*"],
    deny: ["^git status$"]
  });

  assert.equal(filter.matches("brew install gh"), true);
  assert.equal(filter.matches("git status"), false);
});

test("allow list restricts commands", () => {
  const filter = createFilter({
    allow: ["^brew install", "^npm i"],
    deny: []
  });

  assert.equal(filter.matches("brew install jq"), true);
  assert.equal(filter.matches("npm i lodash"), true);
  assert.equal(filter.matches("pip install requests"), false);
});
