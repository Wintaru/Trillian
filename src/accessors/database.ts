import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";

const sqlite = new Database("data/bot.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
