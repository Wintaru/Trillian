function prefix(level: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [PID:${process.pid}] [${level}]`;
}

export function info(message: string, ...args: unknown[]): void {
  console.log(`${prefix("INFO")} ${message}`, ...args);
}

export function warn(message: string, ...args: unknown[]): void {
  console.warn(`${prefix("WARN")} ${message}`, ...args);
}

export function error(message: string, ...args: unknown[]): void {
  console.error(`${prefix("ERROR")} ${message}`, ...args);
}
