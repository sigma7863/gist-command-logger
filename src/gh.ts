import { spawnSync } from "node:child_process";

function getGhBin(): string {
  return process.env.GCL_GH_BIN || "gh";
}

export interface GhResult {
  status: number;
  stdout: string;
  stderr: string;
}

export function runGh(args: string[], options: Parameters<typeof spawnSync>[2] = {}): GhResult {
  const res = spawnSync(getGhBin(), args, {
    encoding: "utf8",
    env: process.env,
    ...options
  });

  const stdout = typeof res.stdout === "string" ? res.stdout : String(res.stdout || "");
  const stderr = typeof res.stderr === "string" ? res.stderr : String(res.stderr || "");

  return {
    status: res.status ?? 1,
    stdout,
    stderr
  };
}

export function ghAuthStatus(): GhResult {
  return runGh(["auth", "status", "-h", "github.com"]);
}

export function ghApi(args: string[]): string {
  const res = runGh(["api", ...args]);
  if (res.status !== 0) {
    const err = new Error(`gh api failed: ${res.stderr || res.stdout}`.trim()) as Error & { code?: number };
    err.code = res.status;
    throw err;
  }
  return res.stdout;
}
