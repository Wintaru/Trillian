export function info(message: string, ...args: unknown[]): void {
  console.log(`[INFO] ${message}`, ...args);
}

export function warn(message: string, ...args: unknown[]): void {
  console.warn(`[WARN] ${message}`, ...args);
}

export function error(message: string, ...args: unknown[]): void {
  console.error(`[ERROR] ${message}`, ...args);
}
