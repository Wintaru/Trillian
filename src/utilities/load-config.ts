export interface Config {
  token: string;
  clientId: string;
  guildId: string;
  prefix: string;
  purgeChannelIds: string[];
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
  });
}
