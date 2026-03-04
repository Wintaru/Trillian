import "dotenv/config";
import { loadConfig } from "./load-config.js";

export type { Config } from "./load-config.js";
export { loadConfig } from "./load-config.js";

export const config = loadConfig(process.env);
