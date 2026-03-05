export interface Config {
  token: string;
  clientId: string;
  guildId: string;
  prefix: string;
  purgeChannelIds: string[];
  xpCooldownSeconds: number;
  xpMin: number;
  xpMax: number;
  levelUpChannelId: string | null;
  ollamaUrl: string;
  ollamaModel: string;
  ollamaContextMessages: number;
}

function parseChannelIds(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((id) => id.trim()).filter(Boolean);
}

function requireEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  return Object.freeze({
    token: requireEnv(env, "DISCORD_TOKEN"),
    clientId: requireEnv(env, "DISCORD_CLIENT_ID"),
    guildId: requireEnv(env, "DISCORD_GUILD_ID"),
    prefix: env["BOT_PREFIX"] ?? "!",
    purgeChannelIds: parseChannelIds(env["PURGE_CHANNEL_IDS"]),
    xpCooldownSeconds: parseInt(env["XP_COOLDOWN_SECONDS"] ?? "60", 10),
    xpMin: parseInt(env["XP_MIN"] ?? "15", 10),
    xpMax: parseInt(env["XP_MAX"] ?? "25", 10),
    levelUpChannelId: env["LEVELUP_CHANNEL_ID"] ?? null,
    ollamaUrl: env["OLLAMA_URL"] ?? "http://localhost:11434",
    ollamaModel: env["OLLAMA_MODEL"] ?? "mistral-nemo:12b",
    ollamaContextMessages: parseInt(env["OLLAMA_CONTEXT_MESSAGES"] ?? "10", 10),
  });
}
