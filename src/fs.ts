import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { APP_ID, CONFIG_ENV_VAR, DEFAULT_CONFIG, type Config, type State } from "./constants";

function isWindows(): boolean {
  return process.platform === "win32";
}

function getHomeDir(): string {
  return process.env.GCL_HOME || os.homedir();
}

function getDefaultConfigPath(): string {
  if (isWindows()) {
    const base = process.env.APPDATA || path.join(getHomeDir(), "AppData", "Roaming");
    return path.join(base, APP_ID, "config.json");
  }
  const base = process.env.XDG_CONFIG_HOME || path.join(getHomeDir(), ".config");
  return path.join(base, APP_ID, "config.json");
}

function getStateDir(): string {
  if (isWindows()) {
    const base = process.env.LOCALAPPDATA || path.join(getHomeDir(), "AppData", "Local");
    return path.join(base, APP_ID, "state");
  }
  const base = process.env.XDG_STATE_HOME || path.join(getHomeDir(), ".local", "state");
  return path.join(base, APP_ID);
}

export function resolveConfigPath(): string {
  return process.env[CONFIG_ENV_VAR] || getDefaultConfigPath();
}

export interface Paths {
  configPath: string;
  configDir: string;
  stateDir: string;
  logPath: string;
  statePath: string;
}

export function getPaths(): Paths {
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

export function ensureDirs(): Paths {
  const paths = getPaths();
  fs.mkdirSync(paths.configDir, { recursive: true });
  fs.mkdirSync(paths.stateDir, { recursive: true });
  return paths;
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function mergeConfig(config: Partial<Config> = {}): Config {
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

export function loadConfig(): { paths: Paths; config: Config } {
  const paths = ensureDirs();
  if (!fs.existsSync(paths.configPath)) {
    writeJsonFile(paths.configPath, DEFAULT_CONFIG);
  }
  const fileConfig = readJsonFile<Partial<Config>>(paths.configPath, DEFAULT_CONFIG);
  return { paths, config: mergeConfig(fileConfig) };
}

export function loadState(statePath: string): State {
  return readJsonFile<State>(statePath, {
    lastUploadedLine: 0,
    singleGistId: null,
    dailyGists: {}
  });
}
