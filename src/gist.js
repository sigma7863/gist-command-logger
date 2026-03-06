import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ghApi } from "./gh.js";

function isPublic(visibility) {
  return visibility === "public";
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function parseJson(input) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function callJsonApi(endpoint, method, payload) {
  const file = path.join(os.tmpdir(), `gcl-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  try {
    fs.writeFileSync(file, JSON.stringify(payload), "utf8");
    const output = ghApi([endpoint, "-X", method, "--input", file]);
    const parsed = parseJson(output);
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

function getGist(gistId) {
  const output = ghApi([`/gists/${gistId}`]);
  const parsed = parseJson(output);
  if (!parsed) {
    throw new Error(`failed to parse gist payload for ${gistId}`);
  }
  return parsed;
}

function createGist({ filename, content, description, visibility }) {
  const parsed = callJsonApi("/gists", "POST", {
    description,
    public: isPublic(visibility),
    files: {
      [filename]: {
        content
      }
    }
  });

  if (!parsed?.id) {
    throw new Error("failed to create gist");
  }
  return parsed;
}

function updateGist({ gistId, filename, content }) {
  const parsed = callJsonApi(`/gists/${gistId}`, "PATCH", {
    files: {
      [filename]: {
        content
      }
    }
  });
  if (!parsed?.id) {
    throw new Error(`failed to update gist: ${gistId}`);
  }
  return parsed;
}

function appendToExistingFile(gistId, filename, contentToAppend) {
  const gist = getGist(gistId);
  const files = gist.files || {};
  const current = files[filename]?.content || "";
  const merged = current ? `${current}\n${contentToAppend}` : contentToAppend;
  return updateGist({ gistId, filename, content: merged });
}

function uploadSingleMode({ state, config, content }) {
  const filename = "commands.log";
  if (!state.singleGistId) {
    const gist = createGist({
      filename,
      content,
      description: "Command log (single mode)",
      visibility: config.gist.visibility
    });
    state.singleGistId = gist.id;
    return { gistId: gist.id, created: true };
  }

  appendToExistingFile(state.singleGistId, filename, content);
  return { gistId: state.singleGistId, created: false };
}

function uploadDailyMode({ state, config, content }) {
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
    return { gistId: gist.id, created: true, key: day };
  }

  appendToExistingFile(state.dailyGists[day], filename, content);
  return { gistId: state.dailyGists[day], created: false, key: day };
}

function uploadPerEventMode({ config, lines }) {
  const gistIds = [];
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

export function uploadLines({ config, state, lines }) {
  if (lines.length === 0) {
    return { uploadedCount: 0, gistIds: [] };
  }

  if (config.gist.mode === "per-event") {
    const gistIds = uploadPerEventMode({ config, lines });
    return { uploadedCount: lines.length, gistIds };
  }

  const content = lines.join("\n");
  if (config.gist.mode === "single") {
    const result = uploadSingleMode({ state, config, content });
    return { uploadedCount: lines.length, gistIds: [result.gistId] };
  }

  const result = uploadDailyMode({ state, config, content });
  return { uploadedCount: lines.length, gistIds: [result.gistId] };
}
