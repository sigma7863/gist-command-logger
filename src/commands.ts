import fs from "node:fs";
import path from "node:path";
import { ensureDirs, loadConfig, loadState, resolveConfigPath, writeJsonFile } from "./fs";
import { appendRecord, formatRecord, readRecords, type CommandRecord } from "./records";
import { createFilter } from "./filter";
import { redactSecrets } from "./redact";
import { uploadLines } from "./gist";
import { ghAuthStatus, runGh } from "./gh";
import { detectShell, installHooks } from "./hooks";
import type { Config } from "./constants";

function getArg(args: string[], key: string, fallback: string | null = null): string | null {
  const idx = args.indexOf(key);
  if (idx === -1 || idx + 1 >= args.length) {
    return fallback;
  }
  return args[idx + 1] || fallback;
}

function hasFlag(args: string[], key: string): boolean {
  return args.includes(key);
}

function normalizeMode(value: string, fallback: Config["gist"]["mode"]): Config["gist"]["mode"] {
  if (value === "daily" || value === "single" || value === "per-event") {
    return value;
  }
  return fallback;
}

function normalizeVisibility(value: string, fallback: Config["gist"]["visibility"]): Config["gist"]["visibility"] {
  if (value === "secret" || value === "public") {
    return value;
  }
  return fallback;
}

function isUploadTiming(value: string): value is Config["upload"]["timing"] {
  return value === "immediate" || value === "manual" || value === "on-shell-exit";
}

export function cmdInit(args: string[]): void {
  const shellArg = getArg(args, "--shell", "auto") ?? "auto";
  const shell = shellArg === "auto" ? detectShell() : (shellArg as "zsh" | "bash");
  const binName = getArg(args, "--bin", "gist-command-logger") ?? "gist-command-logger";

  const { paths, config } = loadConfig();

  const mode = getArg(args, "--mode", config.gist.mode) ?? config.gist.mode;
  const visibility = getArg(args, "--visibility", config.gist.visibility) ?? config.gist.visibility;
  const timing = getArg(args, "--timing", config.upload.timing) ?? config.upload.timing;

  config.gist.mode = normalizeMode(mode, config.gist.mode);
  config.gist.visibility = normalizeVisibility(visibility, config.gist.visibility);
  config.upload.timing = isUploadTiming(timing) ? timing : config.upload.timing;

  writeJsonFile(paths.configPath, config);

  const target = installHooks(shell, binName);
  console.log(`Initialized ${shell} hook in ${target}`);
  console.log(`Config: ${paths.configPath}`);
  console.log("Reload your shell: exec $SHELL -l");
}

export function cmdRecordFinish(args: string[]): void {
  const shell = getArg(args, "--shell", "unknown") ?? "unknown";
  const exitCodeRaw = getArg(args, "--exit-code", "0") ?? "0";
  const exitCode = Number.parseInt(exitCodeRaw, 10);
  const cmd = process.env.GCL_HOOK_COMMAND || "";
  const startedAt = process.env.GCL_HOOK_STARTED_AT || new Date().toISOString();

  if (!cmd.trim()) {
    return;
  }

  const { paths, config } = loadConfig();
  const record: CommandRecord = {
    startedAt,
    finishedAt: new Date().toISOString(),
    shell,
    cwd: process.cwd(),
    command: cmd,
    exitCode: Number.isNaN(exitCode) ? 0 : exitCode
  };

  appendRecord(paths.logPath, record);

  if (config.upload.timing === "immediate") {
    try {
      runUpload({ quiet: true });
    } catch {
      // Ignore upload errors during interactive shell usage.
    }
  }
}

export function runUpload(options: { quiet?: boolean } = {}): void {
  const { config, paths } = loadConfig();
  const state = loadState(paths.statePath);
  const records = readRecords(paths.logPath);

  const startIdx = Math.max(0, state.lastUploadedLine || 0);
  const pending = records.slice(startIdx);

  if (pending.length === 0) {
    if (!options.quiet) {
      console.log("No pending command records.");
    }
    return;
  }

  const filter = createFilter(config.filter);
  const matched = pending.filter((r) => filter.matches(r.command));

  const lines = matched.map((record) => {
    const cloned: Partial<CommandRecord> = {
      ...record,
      command: config.redaction.enabled ? redactSecrets(record.command) : record.command
    };
    return formatRecord(cloned);
  });

  if (lines.length > 0) {
    const result = uploadLines({ config, state, lines });
    if (!options.quiet) {
      console.log(`Uploaded ${result.uploadedCount} entries to Gist.`);
      if (result.gistIds.length > 0) {
        console.log(`Gists: ${result.gistIds.join(", ")}`);
      }
    }
  } else if (!options.quiet) {
    console.log("No records matched filter rules.");
  }

  state.lastUploadedLine = records.length;
  writeJsonFile(paths.statePath, state);
}

export function cmdRunUpload(): void {
  runUpload({ quiet: false });
}

export function cmdStatus(): void {
  const { paths, config } = loadConfig();
  const state = loadState(paths.statePath);
  const auth = ghAuthStatus();

  const logExists = fs.existsSync(paths.logPath);
  const recordCount = logExists ? readRecords(paths.logPath).length : 0;

  console.log(`Config path: ${paths.configPath}`);
  console.log(`State path: ${paths.statePath}`);
  console.log(`Log path: ${paths.logPath}`);
  console.log(`Records: ${recordCount}`);
  console.log(`Gist mode: ${config.gist.mode}`);
  console.log(`Visibility: ${config.gist.visibility}`);
  console.log(`Upload timing: ${config.upload.timing}`);
  console.log(`lastUploadedLine: ${state.lastUploadedLine || 0}`);
  console.log(`gh auth: ${auth.status === 0 ? "ok" : "not logged in"}`);

  if (auth.status !== 0) {
    const hint = (auth.stderr || auth.stdout).trim();
    if (hint) {
      console.log(hint);
    }
  }
}

export function cmdAuth(args: string[]): void {
  const shouldRun = hasFlag(args, "--run");
  if (!shouldRun) {
    console.log("Run the following command to authenticate GitHub CLI:");
    console.log("  gh auth login -h github.com");
    console.log("Then verify with:");
    console.log("  gist-command-logger status");
    return;
  }

  const res = runGh(["auth", "login", "-h", "github.com"], { stdio: "inherit" });
  process.exit(res.status ?? 1);
}

export function cmdHelp(): void {
  const bin = path.basename(process.argv[1] || "gist-command-logger");
  console.log(`${bin} commands:`);
  console.log("  init [--shell zsh|bash|auto] [--mode daily|single|per-event] [--visibility secret|public] [--timing immediate|manual|on-shell-exit]");
  console.log("  status");
  console.log("  auth [--run]");
  console.log("  run-upload");
  console.log("  record-finish --shell <zsh|bash> --exit-code <n>  (internal)");
}

export function cmdInstallScriptUnix(): void {
  const script = `#!/usr/bin/env sh
set -eu
npm install -g @gist-command-logger/cli
gist-command-logger init
`;
  process.stdout.write(script);
}

export function cmdInstallScriptPowershell(): void {
  const script = `npm install -g @gist-command-logger/cli\ngist-command-logger init --shell bash\n`;
  process.stdout.write(script);
}

export function cmdDoctor(): void {
  ensureDirs();
  const auth = ghAuthStatus();
  const configPath = resolveConfigPath();
  console.log(`Config env: ${process.env.GCL_CONFIG_PATH ? "set" : "default"}`);
  console.log(`Config file: ${configPath}`);
  console.log(`gh auth status: ${auth.status === 0 ? "ok" : "failed"}`);
}
