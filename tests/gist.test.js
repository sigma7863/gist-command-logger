import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { uploadLines } from "../src/gist.js";

function makeFakeGh() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gcl-gh-"));
  const dbPath = path.join(dir, "db.json");
  const ghPath = path.join(dir, "fake-gh.js");

  fs.writeFileSync(dbPath, JSON.stringify({ counter: 0, gists: {} }), "utf8");
  fs.writeFileSync(
    ghPath,
    `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const dbPath = process.env.FAKE_GH_DB;
const args = process.argv.slice(2);
const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));

function save() { fs.writeFileSync(dbPath, JSON.stringify(db), "utf8"); }

if (args[0] === "api") {
  const endpoint = args[1];
  const methodIdx = args.indexOf("-X");
  const method = methodIdx >= 0 ? args[methodIdx + 1] : "GET";
  const inputIdx = args.indexOf("--input");
  const payload = inputIdx >= 0 ? JSON.parse(fs.readFileSync(args[inputIdx + 1], "utf8")) : null;

  if (endpoint === "/gists" && method === "POST") {
    db.counter += 1;
    const id = "gist-" + db.counter;
    db.gists[id] = { id, files: payload.files || {}, description: payload.description || "" };
    save();
    process.stdout.write(JSON.stringify({ id, files: db.gists[id].files }));
    process.exit(0);
  }

  if (endpoint.startsWith("/gists/") && method === "GET") {
    const id = endpoint.split("/")[2];
    const gist = db.gists[id] || { id, files: {} };
    process.stdout.write(JSON.stringify(gist));
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

  process.stderr.write("unsupported endpoint");
  process.exit(1);
}

if (args[0] === "auth" && args[1] === "status") {
  process.stdout.write("ok");
  process.exit(0);
}

process.stderr.write("unsupported command");
process.exit(1);
`,
    "utf8"
  );
  fs.chmodSync(ghPath, 0o755);

  return { ghPath, dbPath, dir };
}

test("daily mode reuses same gist within a day", () => {
  const fake = makeFakeGh();
  process.env.GCL_GH_BIN = fake.ghPath;
  process.env.FAKE_GH_DB = fake.dbPath;

  const state = { lastUploadedLine: 0, singleGistId: null, dailyGists: {} };
  const config = { gist: { mode: "daily", visibility: "secret" } };

  const first = uploadLines({ config, state, lines: ["line-1"] });
  const second = uploadLines({ config, state, lines: ["line-2"] });

  assert.equal(first.gistIds.length, 1);
  assert.equal(second.gistIds[0], first.gistIds[0]);

  const db = JSON.parse(fs.readFileSync(fake.dbPath, "utf8"));
  assert.equal(db.counter, 1);
});

test("single mode stores gist id in state", () => {
  const fake = makeFakeGh();
  process.env.GCL_GH_BIN = fake.ghPath;
  process.env.FAKE_GH_DB = fake.dbPath;

  const state = { lastUploadedLine: 0, singleGistId: null, dailyGists: {} };
  const config = { gist: { mode: "single", visibility: "secret" } };

  const result = uploadLines({ config, state, lines: ["line-a"] });
  assert.equal(result.uploadedCount, 1);
  assert.equal(typeof state.singleGistId, "string");
});

test("per-event mode creates one gist per line", () => {
  const fake = makeFakeGh();
  process.env.GCL_GH_BIN = fake.ghPath;
  process.env.FAKE_GH_DB = fake.dbPath;

  const state = { lastUploadedLine: 0, singleGistId: null, dailyGists: {} };
  const config = { gist: { mode: "per-event", visibility: "secret" } };

  const result = uploadLines({ config, state, lines: ["x", "y"] });
  assert.equal(result.uploadedCount, 2);
  assert.equal(result.gistIds.length, 2);
});
