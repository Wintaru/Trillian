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
  campaignChannelId: string | undefined;
  ollamaGmTimeoutMs: number;
  weatherChannelId: string | undefined;
  weatherLocation: string;
  weatherDailyTime: string;
  weatherApiKey: string | undefined;
  weatherAlertIntervalMs: number;
  announceChannelId: string | undefined;
  deeplApiKey: string | undefined;
  vocabChannelId: string | undefined;
  vocabDailyTime: string;
  vocabDefaultLanguage: string;
  challengeChannelId: string | undefined;
  challengeDailyTime: string;
  challengeDirection: string;
  challengeDurationMinutes: number;
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
    campaignChannelId: env["CAMPAIGN_CHANNEL_ID"] ?? undefined,
    ollamaGmTimeoutMs: parseInt(env["OLLAMA_GM_TIMEOUT_MS"] ?? "120000", 10),
    weatherChannelId: env["WEATHER_CHANNEL_ID"] ?? undefined,
    weatherLocation: env["WEATHER_LOCATION"] ?? "",
    weatherDailyTime: env["WEATHER_DAILY_TIME"] ?? "07:00",
    weatherApiKey: env["WEATHERAPI_KEY"] ?? undefined,
    weatherAlertIntervalMs: parseInt(env["WEATHER_ALERT_INTERVAL_MS"] ?? "300000", 10),
    announceChannelId: env["ANNOUNCE_CHANNEL_ID"] ?? undefined,
    deeplApiKey: env["DEEPL_API_KEY"] ?? undefined,
    vocabChannelId: env["VOCAB_CHANNEL_ID"] ?? undefined,
    vocabDailyTime: env["VOCAB_DAILY_TIME"] ?? "08:00",
    vocabDefaultLanguage: env["VOCAB_DEFAULT_LANGUAGE"] ?? "ES",
    challengeChannelId: env["CHALLENGE_CHANNEL_ID"] ?? undefined,
    challengeDailyTime: env["CHALLENGE_DAILY_TIME"] ?? "09:00",
    challengeDirection: env["CHALLENGE_DIRECTION"] ?? "to_english",
    challengeDurationMinutes: parseInt(env["CHALLENGE_DURATION_MINUTES"] ?? "480", 10),
  });
}
