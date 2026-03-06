function compile(patterns) {
  return patterns
    .map((pattern) => {
      try {
        return new RegExp(pattern, "i");
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function createFilter(filterConfig) {
  const allowList = compile(filterConfig.allow || []);
  const denyList = compile(filterConfig.deny || []);

  return {
    matches(command) {
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
