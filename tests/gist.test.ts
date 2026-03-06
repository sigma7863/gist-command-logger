import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect } from "bun:test";
import { uploadLines } from "../src/gist";
import type { Config, State } from "../src/constants";

function makeFakeGh() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gcl-gh-"));
  const dbPath = path.join(dir, "db.json");
  const ghPath = path.join(dir, "fake-gh.js");

  fs.writeFileSync(dbPath, JSON.stringify({ counter: 0, gists: {} }), "utf8");
  fs.writeFileSync(
    ghPath,
    `#!/usr/bin/env node
const fs = require("fs");
const dbPath = process.env.FAKE_GH_DB;
const args = process.argv.slice(2);
const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
function save() { fs.writeFileSync(dbPath, JSON.stringify(db), "utf8"); }
if (args[0] === "api") {
  const endpoint = args[1];
  const method = args.includes("-X") ? args[args.indexOf("-X") + 1] : "GET";
  const payload = args.includes("--input") ? JSON.parse(fs.readFileSync(args[args.indexOf("--input") + 1], "utf8")) : null;
  if (endpoint === "/gists" && method === "POST") {
    db.counter += 1;
    const id = "gist-" + db.counter;
    db.gists[id] = { id, files: payload.files || {} };
    save();
    process.stdout.write(JSON.stringify({ id, files: db.gists[id].files }));
    process.exit(0);
  }
  if (endpoint.startsWith("/gists/") && method === "GET") {
    const id = endpoint.split("/")[2];
    process.stdout.write(JSON.stringify(db.gists[id] || { id, files: {} }));
    process.exit(0);
  }
  if (endpoint.startsWith("/gists/") && method === "PATCH") {
    const id = endpoint.split("/")[2];
    db.gists[id] = db.gists[id] || { id, files: {} };
    db.gists[id].files = payload.files;
    save();
    process.stdout.write(JSON.stringify({ id }));
    process.exit(0);
  }
}
if (args[0] === "auth" && args[1] === "status") {
  process.stdout.write("ok");
  process.exit(0);
}
process.exit(1);
`,
    "utf8"
  );
  fs.chmodSync(ghPath, 0o755);

  return { ghPath, dbPath };
}

function baseState(): State {
  return { lastUploadedLine: 0, singleGistId: null, dailyGists: {} };
}

test("daily mode reuses same gist within a day", () => {
  const fake = makeFakeGh();
  process.env.GCL_GH_BIN = fake.ghPath;
  process.env.FAKE_GH_DB = fake.dbPath;

  const state = baseState();
  const config: Config = {
    gist: { mode: "daily", visibility: "secret" },
    upload: { timing: "manual" },
    filter: { allow: [".*"], deny: [] },
    redaction: { enabled: true }
  };

  const first = uploadLines({ config, state, lines: ["line-1"] });
  const second = uploadLines({ config, state, lines: ["line-2"] });

  expect(first.gistIds.length).toBe(1);
  expect(second.gistIds[0]).toBe(first.gistIds[0]);

  const db = JSON.parse(fs.readFileSync(fake.dbPath, "utf8"));
  expect(db.counter).toBe(1);
});

test("single mode stores gist id in state", () => {
  const fake = makeFakeGh();
  process.env.GCL_GH_BIN = fake.ghPath;
  process.env.FAKE_GH_DB = fake.dbPath;

  const state = baseState();
  const config: Config = {
    gist: { mode: "single", visibility: "secret" },
    upload: { timing: "manual" },
    filter: { allow: [".*"], deny: [] },
    redaction: { enabled: true }
  };

  const result = uploadLines({ config, state, lines: ["line-a"] });
  expect(result.uploadedCount).toBe(1);
  expect(typeof state.singleGistId).toBe("string");
});

test("per-event mode creates one gist per line", () => {
  const fake = makeFakeGh();
  process.env.GCL_GH_BIN = fake.ghPath;
  process.env.FAKE_GH_DB = fake.dbPath;

  const state = baseState();
  const config: Config = {
    gist: { mode: "per-event", visibility: "secret" },
    upload: { timing: "manual" },
    filter: { allow: [".*"], deny: [] },
    redaction: { enabled: true }
  };

  const result = uploadLines({ config, state, lines: ["x", "y"] });
  expect(result.uploadedCount).toBe(2);
  expect(result.gistIds.length).toBe(2);
});
