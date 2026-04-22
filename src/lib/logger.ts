// Logging utility for structured logging

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = formatTimestamp();
  const contextStr = context ? ` | ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

export function log(level: LogLevel, message: string, context?: LogContext): void {
  if (process.env.NODE_ENV === "test") return;

  const formatted = formatMessage(level, message, context);

  switch (level) {
    case "debug":
      console.debug(formatted);
      break;
    case "info":
      console.info(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),

  // Helper methods for common scenarios
  auth: {
    login: (email: string, success: boolean, context?: LogContext) =>
      log("info", `Auth: Login ${success ? "success" : "failed"} for ${email}`, context),
    logout: (userId: number) => log("info", `Auth: User ${userId} logged out`),
    sessionExpired: (userId: number) => log("warn", `Auth: Session expired for user ${userId}`),
  },

  db: {
    query: (operation: string, duration: number) =>
      log("debug", `DB: ${operation} completed in ${duration}ms`),
    error: (operation: string, error: string) =>
      log("error", `DB: ${operation} failed - ${error}`),
  },

  wa: {
    send: (phone: string, type: string, success: boolean, context?: LogContext) =>
      log("info", `WA: Send ${type} to ${phone} ${success ? "success" : "failed"}`, context),
    retry: (phone: string, type: string, attempt: number) =>
      log("warn", `WA: Retry ${type} to ${phone} (attempt ${attempt})`),
    circuitOpen: () => log("error", "WA: Circuit breaker triggered - gateway unhealthy"),
  },

  voucher: {
    generate: (count: number, date: string) =>
      log("info", `Voucher: Generated ${count} vouchers for ${date}`),
    scan: (code: string, success: boolean, guest?: string) =>
      log("info", `Voucher: Scan ${code} ${success ? "success" : "failed"}${guest ? ` (${guest})` : ""}`),
    expire: (codes: string[]) =>
      log("info", `Voucher: Expired ${codes.length} vouchers`),
  },

  rating: {
    submit: (type: string, rating: number, referenceLabel: string) =>
      log("info", `Rating: ${type} submitted for ${referenceLabel} (${rating}/5)`),
  },
};