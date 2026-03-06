interface FilterConfig {
  allow?: string[];
  deny?: string[];
}

function compile(patterns: string[]): RegExp[] {
  return patterns
    .map((pattern) => {
      try {
        return new RegExp(pattern, "i");
      } catch {
        return null;
      }
    })
    .filter((r): r is RegExp => Boolean(r));
}

export function createFilter(filterConfig: FilterConfig) {
  const allowList = compile(filterConfig.allow || []);
  const denyList = compile(filterConfig.deny || []);

  return {
    matches(command: string): boolean {
      const normalized = `${command || ""}`.trim();
      if (!normalized) {
        return false;
      }

      const allowed = allowList.length === 0 || allowList.some((regex) => regex.test(normalized));
      const denied = denyList.some((regex) => regex.test(normalized));
      return allowed && !denied;
    }
  };
}
