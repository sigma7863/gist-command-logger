import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect } from "bun:test";
import { cmdInit, cmdRecordFinish, runUpload } from "../src/commands";
import { loadConfig, loadState, writeJsonFile } from "../src/fs";

function makeFakeGh() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gcl-int-gh-"));
  const dbPath = path.join(dir, "db.json");
  const ghPath = path.join(dir, "fake-gh.js");

  fs.writeFileSync(dbPath, JSON.stringify({ counter: 0, gists: {} }), "utf8");
  fs.writeFileSync(
    ghPath,
    `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const dbPath = process.env.FAKE_GH_DB;
const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
function save() { fs.writeFileSync(dbPath, JSON.stringify(db), "utf8"); }
if (args[0] === "auth" && args[1] === "status") { process.stdout.write("ok"); process.exit(0); }
if (args[0] === "api") {
  const endpoint = args[1];
  const method = args.includes("-X") ? args[args.indexOf("-X") + 1] : "GET";
  const payload = args.includes("--input") ? JSON.parse(fs.readFileSync(args[args.indexOf("--input") + 1], "utf8")) : null;
  if (endpoint === "/gists" && method === "POST") {
    db.counter += 1;
    const id = "id-" + db.counter;
    db.gists[id] = { id, files: payload.files };
    save();
    process.stdout.write(JSON.stringify({ id }));
    process.exit(0);
  }
  if (endpoint.startsWith("/gists/") && method === "GET") {
    const id = endpoint.split("/")[2];
    process.stdout.write(JSON.stringify(db.gists[id] || { id, files: {} }));
    process.exit(0);
  }
  if (endpoint.startsWith("/gists/") && method === "PATCH") {
    const id = endpoint.split("/")[2];
    db.gists[id] = { id, files: payload.files };
    save();
    process.stdout.write(JSON.stringify({ id }));
    process.exit(0);
  }
}
process.exit(1);
`,
    "utf8"
  );
  fs.chmodSync(ghPath, 0o755);

  return { dbPath, ghPath };
}

test("init writes zsh block and run-upload uploads filtered records", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "gcl-home-"));
  const tempConfigPath = path.join(tempHome, "config", "config.json");

  process.env.GCL_HOME = tempHome;
  process.env.GCL_CONFIG_PATH = tempConfigPath;

  cmdInit(["--shell", "zsh", "--timing", "manual"]);

  const zshrc = fs.readFileSync(path.join(tempHome, ".zshrc"), "utf8");
  expect(zshrc.includes("gist-command-logger")).toBe(true);

  const { paths, config } = loadConfig();
  config.filter.allow = ["^brew install", "^npm i"];
  config.filter.deny = ["^npm i --dry-run"];
  config.upload.timing = "manual";
  writeJsonFile(paths.configPath, config);

  const fake = makeFakeGh();
  process.env.GCL_GH_BIN = fake.ghPath;
  process.env.FAKE_GH_DB = fake.dbPath;

  process.env.GCL_HOOK_COMMAND = "brew install jq";
  process.env.GCL_HOOK_STARTED_AT = new Date().toISOString();
  cmdRecordFinish(["--shell", "zsh", "--exit-code", "0"]);

  process.env.GCL_HOOK_COMMAND = "npm i --dry-run lodash";
  process.env.GCL_HOOK_STARTED_AT = new Date().toISOString();
  cmdRecordFinish(["--shell", "zsh", "--exit-code", "0"]);

  runUpload({ quiet: true });

  const db = JSON.parse(fs.readFileSync(fake.dbPath, "utf8"));
  expect(Object.keys(db.gists).length).toBe(1);

  const state = loadState(paths.statePath);
  const logLines = fs.readFileSync(paths.logPath, "utf8").trim().split(/\r?\n/);
  expect(state.lastUploadedLine).toBe(logLines.length);
});
