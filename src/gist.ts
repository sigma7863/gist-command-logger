import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ghApi } from "./gh";
import type { Config, State } from "./constants";

function isPublic(visibility: Config["gist"]["visibility"]): boolean {
  return visibility === "public";
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseJson<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

function callJsonApi<T>(endpoint: string, method: string, payload: unknown): T {
  const file = path.join(os.tmpdir(), `gcl-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  try {
    fs.writeFileSync(file, JSON.stringify(payload), "utf8");
    const output = ghApi([endpoint, "-X", method, "--input", file]);
    const parsed = parseJson<T>(output);
    if (!parsed) {
      throw new Error(`failed to parse gh api response for ${endpoint}`);
    }
    return parsed;
  } finally {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

interface GistFile {
  content?: string;
}

interface GistPayload {
  id: string;
  files?: Record<string, GistFile>;
}

function getGist(gistId: string): GistPayload {
  const output = ghApi([`/gists/${gistId}`]);
  const parsed = parseJson<GistPayload>(output);
  if (!parsed) {
    throw new Error(`failed to parse gist payload for ${gistId}`);
  }
  return parsed;
}

function createGist(params: { filename: string; content: string; description: string; visibility: Config["gist"]["visibility"] }): GistPayload {
  const parsed = callJsonApi<GistPayload>("/gists", "POST", {
    description: params.description,
    public: isPublic(params.visibility),
    files: {
      [params.filename]: {
        content: params.content
      }
    }
  });

  if (!parsed?.id) {
    throw new Error("failed to create gist");
  }
  return parsed;
}

function updateGist(params: { gistId: string; filename: string; content: string }): GistPayload {
  const parsed = callJsonApi<GistPayload>(`/gists/${params.gistId}`, "PATCH", {
    files: {
      [params.filename]: {
        content: params.content
      }
    }
  });
  if (!parsed?.id) {
    throw new Error(`failed to update gist: ${params.gistId}`);
  }
  return parsed;
}

function appendToExistingFile(gistId: string, filename: string, contentToAppend: string): GistPayload {
  const gist = getGist(gistId);
  const files = gist.files || {};
  const current = files[filename]?.content || "";
  const merged = current ? `${current}\n${contentToAppend}` : contentToAppend;
  return updateGist({ gistId, filename, content: merged });
}

function uploadSingleMode(state: State, config: Config, content: string): string {
  const filename = "commands.log";
  if (!state.singleGistId) {
    const gist = createGist({
      filename,
      content,
      description: "Command log (single mode)",
      visibility: config.gist.visibility
    });
    state.singleGistId = gist.id;
    return gist.id;
  }

  appendToExistingFile(state.singleGistId, filename, content);
  return state.singleGistId;
}

function uploadDailyMode(state: State, config: Config, content: string): string {
  const day = todayUtc();
  const filename = `commands-${day}.log`;
  state.dailyGists ||= {};

  if (!state.dailyGists[day]) {
    const gist = createGist({
      filename,
      content,
      description: `Command log (${day})`,
      visibility: config.gist.visibility
    });
    state.dailyGists[day] = gist.id;
    return gist.id;
  }

  appendToExistingFile(state.dailyGists[day], filename, content);
  return state.dailyGists[day];
}

function uploadPerEventMode(config: Config, lines: string[]): string[] {
  const gistIds: string[] = [];
  for (const line of lines) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `command-${ts}.log`;
    const gist = createGist({
      filename,
      content: line,
      description: `Command event ${ts}`,
      visibility: config.gist.visibility
    });
    gistIds.push(gist.id);
  }
  return gistIds;
}

export function uploadLines(params: { config: Config; state: State; lines: string[] }): { uploadedCount: number; gistIds: string[] } {
  const { config, state, lines } = params;
  if (lines.length === 0) {
    return { uploadedCount: 0, gistIds: [] };
  }

  if (config.gist.mode === "per-event") {
    const gistIds = uploadPerEventMode(config, lines);
    return { uploadedCount: lines.length, gistIds };
  }

  const content = lines.join("\n");
  if (config.gist.mode === "single") {
    const gistId = uploadSingleMode(state, config, content);
    return { uploadedCount: lines.length, gistIds: [gistId] };
  }

  const gistId = uploadDailyMode(state, config, content);
  return { uploadedCount: lines.length, gistIds: [gistId] };
}
