export function getSingleQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

export function normalizeInternalPath(rawPath: string, fallback = "/admin"): string {
  if (!rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return fallback;
  }

  return rawPath;
}
