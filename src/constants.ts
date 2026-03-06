export const APP_ID = "gist-command-logger";
export const CONFIG_ENV_VAR = "GCL_CONFIG_PATH";
export const DEBUG_ENV_VAR = "GCL_DEBUG";

export const CONFIG_MARKERS = {
  zshStart: "# >>> gist-command-logger >>>",
  zshEnd: "# <<< gist-command-logger <<<",
  bashStart: "# >>> gist-command-logger >>>",
  bashEnd: "# <<< gist-command-logger <<<"
} as const;

export type GistMode = "daily" | "single" | "per-event";
export type GistVisibility = "secret" | "public";
export type UploadTiming = "immediate" | "manual" | "on-shell-exit";

export interface Config {
  gist: {
    visibility: GistVisibility;
    mode: GistMode;
  };
  upload: {
    timing: UploadTiming;
  };
  filter: {
    allow: string[];
    deny: string[];
  };
  redaction: {
    enabled: boolean;
  };
}

export interface State {
  lastUploadedLine: number;
  singleGistId: string | null;
  dailyGists: Record<string, string>;
}

export const DEFAULT_CONFIG: Config = {
  gist: {
    visibility: "secret",
    mode: "daily"
  },
  upload: {
    timing: "immediate"
  },
  filter: {
    allow: [".*"],
    deny: ["^\\s*$", "^gist-command-logger\\b", "^gcl\\b"]
  },
  redaction: {
    enabled: true
  }
};
