import fs from "node:fs";

export interface CommandRecord {
  startedAt: string;
  finishedAt: string;
  shell: string;
  cwd: string;
  command: string;
  exitCode: number;
}

export function appendRecord(logPath: string, record: CommandRecord): void {
  fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`, "utf8");
}

export function readRecords(logPath: string): CommandRecord[] {
  if (!fs.existsSync(logPath)) {
    return [];
  }

  const raw = fs.readFileSync(logPath, "utf8");
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as CommandRecord;
      } catch {
        return null;
      }
    })
    .filter((record): record is CommandRecord => Boolean(record));
}

export function formatRecord(record: Partial<CommandRecord>): string {
  const ts = record.finishedAt || record.startedAt || new Date().toISOString();
  const shell = record.shell || "unknown";
  const code = Number.isInteger(record.exitCode) ? record.exitCode : "?";
  const cwd = record.cwd || "-";
  const command = record.command || "";
  return `[${ts}] [${shell}] [exit:${code}] [${cwd}] ${command}`;
}
