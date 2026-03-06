import { spawnSync } from "node:child_process";

function getGhBin() {
  return process.env.GCL_GH_BIN || "gh";
}

export function runGh(args, options = {}) {
  const res = spawnSync(getGhBin(), args, {
    encoding: "utf8",
    ...options
  });

  return {
    status: res.status ?? 1,
    stdout: res.stdout || "",
    stderr: res.stderr || ""
  };
}

export function ghAuthStatus() {
  return runGh(["auth", "status", "-h", "github.com"]);
}

export function ghApi(args) {
  const res = runGh(["api", ...args]);
  if (res.status !== 0) {
    const err = new Error(`gh api failed: ${res.stderr || res.stdout}`.trim());
    err.code = res.status;
    throw err;
  }
  return res.stdout;
}
