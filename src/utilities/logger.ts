const LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 } as const;
type LogLevel = keyof typeof LEVELS;

function resolveLevel(): LogLevel {
  const raw = (process.env["LOG_LEVEL"] ?? "INFO").toUpperCase();
  if (raw in LEVELS) return raw as LogLevel;
  return "INFO";
}

let currentLevel: LogLevel = resolveLevel();

export function setLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLevel(): LogLevel {
  return currentLevel;
}

function prefix(level: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [PID:${process.pid}] [${level}]`;
}

export function debug(message: string, ...args: unknown[]): void {
  if (LEVELS[currentLevel] >= LEVELS.DEBUG) {
    console.log(`${prefix("DEBUG")} ${message}`, ...args);
  }
}

export function info(message: string, ...args: unknown[]): void {
  if (LEVELS[currentLevel] >= LEVELS.INFO) {
    console.log(`${prefix("INFO")} ${message}`, ...args);
  }
}

export function warn(message: string, ...args: unknown[]): void {
  if (LEVELS[currentLevel] >= LEVELS.WARN) {
    console.warn(`${prefix("WARN")} ${message}`, ...args);
  }
}

export function error(message: string, ...args: unknown[]): void {
  // Errors always log
  console.error(`${prefix("ERROR")} ${message}`, ...args);
}
