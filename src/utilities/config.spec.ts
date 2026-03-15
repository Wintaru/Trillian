import { describe, it, expect } from "vitest";
import { loadConfig } from "./load-config.js";

describe("loadConfig", () => {
  const validEnv = {
    DISCORD_TOKEN: "test-token",
    DISCORD_CLIENT_ID: "test-client-id",
    DISCORD_GUILD_ID: "test-guild-id",
  };

  it("should throw when DISCORD_TOKEN is missing", () => {
    expect(() => loadConfig({})).toThrow(
      "Missing required environment variable: DISCORD_TOKEN",
    );
  });

  it("should throw when DISCORD_CLIENT_ID is missing", () => {
    expect(() => loadConfig({ DISCORD_TOKEN: "t" })).toThrow(
      "Missing required environment variable: DISCORD_CLIENT_ID",
    );
  });

  it("should load config when all required vars are present", () => {
    const config = loadConfig(validEnv);

    expect(config.token).toBe("test-token");
    expect(config.clientId).toBe("test-client-id");
    expect(config.guildId).toBe("test-guild-id");
    expect(config.prefix).toBe("!");
  });

  it("should use custom prefix when BOT_PREFIX is set", () => {
    const config = loadConfig({ ...validEnv, BOT_PREFIX: "?" });

    expect(config.prefix).toBe("?");
  });

  it("should return a frozen object", () => {
    const config = loadConfig(validEnv);

    expect(Object.isFrozen(config)).toBe(true);
  });

  it("should default purgeChannelIds to empty array when not set", () => {
    const config = loadConfig(validEnv);

    expect(config.purgeChannelIds).toEqual([]);
  });

  it("should parse comma-separated PURGE_CHANNEL_IDS", () => {
    const config = loadConfig({ ...validEnv, PURGE_CHANNEL_IDS: "123,456,789" });

    expect(config.purgeChannelIds).toEqual(["123", "456", "789"]);
  });

  it("should trim whitespace from PURGE_CHANNEL_IDS", () => {
    const config = loadConfig({ ...validEnv, PURGE_CHANNEL_IDS: " 123 , 456 " });

    expect(config.purgeChannelIds).toEqual(["123", "456"]);
  });

  it("should default XP config values when not set", () => {
    const config = loadConfig(validEnv);

    expect(config.xpCooldownSeconds).toBe(60);
    expect(config.xpMin).toBe(15);
    expect(config.xpMax).toBe(25);
    expect(config.levelUpChannelId).toBeNull();
  });

  it("should use custom XP config values when set", () => {
    const config = loadConfig({
      ...validEnv,
      XP_COOLDOWN_SECONDS: "30",
      XP_MIN: "10",
      XP_MAX: "50",
      LEVELUP_CHANNEL_ID: "999",
    });

    expect(config.xpCooldownSeconds).toBe(30);
    expect(config.xpMin).toBe(10);
    expect(config.xpMax).toBe(50);
    expect(config.levelUpChannelId).toBe("999");
  });

  it("should default campaignChannelId to undefined when not set", () => {
    const config = loadConfig(validEnv);

    expect(config.campaignChannelId).toBeUndefined();
  });

  it("should use CAMPAIGN_CHANNEL_ID when set", () => {
    const config = loadConfig({ ...validEnv, CAMPAIGN_CHANNEL_ID: "123456" });

    expect(config.campaignChannelId).toBe("123456");
  });

  it("should default Ollama config values when not set", () => {
    const config = loadConfig(validEnv);

    expect(config.ollamaUrl).toBe("http://localhost:11434");
    expect(config.ollamaModel).toBe("mistral-nemo:12b");
    expect(config.ollamaContextMessages).toBe(10);
  });

  it("should use custom Ollama config values when set", () => {
    const config = loadConfig({
      ...validEnv,
      OLLAMA_URL: "http://192.168.1.100:11434",
      OLLAMA_MODEL: "llama3.1:8b",
      OLLAMA_CONTEXT_MESSAGES: "5",
    });

    expect(config.ollamaUrl).toBe("http://192.168.1.100:11434");
    expect(config.ollamaModel).toBe("llama3.1:8b");
    expect(config.ollamaContextMessages).toBe(5);
  });

  it("should default announceChannelId to undefined when not set", () => {
    const config = loadConfig(validEnv);

    expect(config.announceChannelId).toBeUndefined();
  });

  it("should use ANNOUNCE_CHANNEL_ID when set", () => {
    const config = loadConfig({ ...validEnv, ANNOUNCE_CHANNEL_ID: "112233" });

    expect(config.announceChannelId).toBe("112233");
  });

  it("should default challenge config values when not set", () => {
    const config = loadConfig(validEnv);

    expect(config.challengeChannelId).toBeUndefined();
    expect(config.challengeDailyTime).toBe("09:00");
    expect(config.challengeDirection).toBe("to_english");
    expect(config.challengeDurationMinutes).toBe(480);
  });

  it("should use custom challenge config values when set", () => {
    const config = loadConfig({
      ...validEnv,
      CHALLENGE_CHANNEL_ID: "555",
      CHALLENGE_DAILY_TIME: "10:30",
      CHALLENGE_DIRECTION: "from_english",
      CHALLENGE_DURATION_MINUTES: "120",
    });

    expect(config.challengeChannelId).toBe("555");
    expect(config.challengeDailyTime).toBe("10:30");
    expect(config.challengeDirection).toBe("from_english");
    expect(config.challengeDurationMinutes).toBe(120);
  });

  it("should default recipeChannelId to undefined when not set", () => {
    const config = loadConfig(validEnv);

    expect(config.recipeChannelId).toBeUndefined();
  });

  it("should use RECIPE_CHANNEL_ID when set", () => {
    const config = loadConfig({ ...validEnv, RECIPE_CHANNEL_ID: "888" });

    expect(config.recipeChannelId).toBe("888");
  });
});
