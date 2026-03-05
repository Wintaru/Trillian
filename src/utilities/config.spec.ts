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
});
