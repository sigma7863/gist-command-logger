export const APP_ID = "gist-command-logger";
export const CONFIG_ENV_VAR = "GCL_CONFIG_PATH";
export const DEBUG_ENV_VAR = "GCL_DEBUG";

export const CONFIG_MARKERS = {
  zshStart: "# >>> gist-command-logger >>>",
  zshEnd: "# <<< gist-command-logger <<<",
  bashStart: "# >>> gist-command-logger >>>",
  bashEnd: "# <<< gist-command-logger <<<"
};

export const DEFAULT_CONFIG = {
  gist: {
    visibility: "secret",
    mode: "daily"
  },
  upload: {
    timing: "immediate"
  },
  filter: {
    allow: [".*"],
    deny: [
      "^\\s*$",
      "^gist-command-logger\\b",
      "^gcl\\b"
    ]
  },
  redaction: {
    enabled: true
  }
};
