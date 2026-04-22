// Shared database types - untuk menghindari duplikasi di setiap repository

export interface SqliteStatement {
  run: (...params: unknown[]) => { lastInsertRowid?: number | bigint; changes?: number };
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
}

export interface SqliteDatabase {
  exec: (sql: string) => unknown;
  prepare: (sql: string) => SqliteStatement;
}

// Helper untuk timestamp ISO
export function nowIso(): string {
  return new Date().toISOString();
}

// Helper untuk validasi ID
export function isValidId(id: unknown): id is number {
  return typeof id === "number" && id > 0 && Number.isFinite(id);
}

// Helper untuk sanitasi string input
export function sanitizeString(value: unknown, maxLength = 255): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

// Helper untuk parse JSON array dari database
export function parseJsonArray<T>(value: string, fallback: T[] = []): T[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return fallback;
    }
    return parsed as T[];
  } catch {
    return fallback;
  }
}
