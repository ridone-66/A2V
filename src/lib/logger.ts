/**
 * Journalisation structurée, sans données personnelles sensibles.
 * En production, brancher un collecteur (Datadog, Sentry, Loki…).
 */
type LogLevel = "info" | "warn" | "error";

const REDACTED_KEYS = /password|secret|token|authorization|cookie|card|cvv|iban/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[deep]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        REDACTED_KEYS.test(key) ? "[redacted]" : sanitize(item, depth + 1),
      ]),
    );
  }
  if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry = {
    time: new Date().toISOString(),
    level,
    scope: "a2v",
    message,
    ...(context ? { context: sanitize(context) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => log("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => log("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => log("error", message, context),
};
