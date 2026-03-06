import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { APP_ID, CONFIG_ENV_VAR, DEFAULT_CONFIG } from "./constants.js";

function isWindows() {
  return process.platform === "win32";
}

function getDefaultConfigPath() {
  if (isWindows()) {
    const base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(base, APP_ID, "config.json");
  }
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, APP_ID, "config.json");
}

function getStateDir() {
  if (isWindows()) {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(base, APP_ID, "state");
  }
  const base = process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state");
  return path.join(base, APP_ID);
}

export function resolveConfigPath() {
  return process.env[CONFIG_ENV_VAR] || getDefaultConfigPath();
}

export function getPaths() {
  const configPath = resolveConfigPath();
  const stateDir = getStateDir();
  return {
    configPath,
    configDir: path.dirname(configPath),
    stateDir,
    logPath: path.join(stateDir, "command-log.jsonl"),
    statePath: path.join(stateDir, "state.json")
  };
}

export function ensureDirs() {
  const paths = getPaths();
  fs.mkdirSync(paths.configDir, { recursive: true });
  fs.mkdirSync(paths.stateDir, { recursive: true });
  return paths;
}

export function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function mergeConfig(config = {}) {
  return {
    gist: {
      ...DEFAULT_CONFIG.gist,
      ...(config.gist || {})
    },
    upload: {
      ...DEFAULT_CONFIG.upload,
      ...(config.upload || {})
    },
    filter: {
      ...DEFAULT_CONFIG.filter,
      ...(config.filter || {}),
      allow: Array.isArray(config.filter?.allow) ? config.filter.allow : DEFAULT_CONFIG.filter.allow,
      deny: Array.isArray(config.filter?.deny) ? config.filter.deny : DEFAULT_CONFIG.filter.deny
    },
    redaction: {
      ...DEFAULT_CONFIG.redaction,
      ...(config.redaction || {})
    }
  };
}

export function loadConfig() {
  const paths = ensureDirs();
  if (!fs.existsSync(paths.configPath)) {
    writeJsonFile(paths.configPath, DEFAULT_CONFIG);
  }
  const fileConfig = readJsonFile(paths.configPath, DEFAULT_CONFIG);
  return { paths, config: mergeConfig(fileConfig) };
}

export function loadState(statePath) {
  return readJsonFile(statePath, {
    lastUploadedLine: 0,
    singleGistId: null,
    dailyGists: {}
  });
}
