import fs from "node:fs";

export function appendRecord(logPath, record) {
  fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`, "utf8");
}

export function readRecords(logPath) {
  if (!fs.existsSync(logPath)) {
    return [];
  }

  const raw = fs.readFileSync(logPath, "utf8");
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function formatRecord(record) {
  const ts = record.finishedAt || record.startedAt || new Date().toISOString();
  const shell = record.shell || "unknown";
  const code = Number.isInteger(record.exitCode) ? record.exitCode : "?";
  const cwd = record.cwd || "-";
  const command = record.command || "";
  return `[${ts}] [${shell}] [exit:${code}] [${cwd}] ${command}`;
}
