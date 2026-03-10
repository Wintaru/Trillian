import { describe, it, expect, vi } from "vitest";
import { ChannelType, type Client } from "discord.js";
import { createReadyHandler } from "./ready.js";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
}));
vi.mock("../utilities/logger.js", () => mockLogger);

function createMockClient(channel: unknown = null) {
  return {
    user: { tag: "TestBot#1234" },
    channels: { fetch: vi.fn().mockResolvedValue(channel) },
  } as unknown as Client<true>;
}

describe("createReadyHandler", () => {
  it("should return a clientReady handler that fires once", () => {
    const handler = createReadyHandler(undefined);

    expect(handler.event).toBe("clientReady");
    expect(handler.once).toBe(true);
  });

  it("should log the bot tag on ready", async () => {
    const handler = createReadyHandler(undefined);
    const client = createMockClient();

    await handler.execute(client);

    expect(mockLogger.info).toHaveBeenCalledWith("Logged in as TestBot#1234");
  });

  it("should not send a message when announceChannelId is undefined", async () => {
    const handler = createReadyHandler(undefined);
    const client = createMockClient();

    await handler.execute(client);

    expect(client.channels.fetch).not.toHaveBeenCalled();
  });

  it("should send an online message to the configured channel", async () => {
    const mockChannel = { type: ChannelType.GuildText, send: vi.fn() };
    const handler = createReadyHandler("112233");
    const client = createMockClient(mockChannel);

    await handler.execute(client);

    expect(client.channels.fetch).toHaveBeenCalledWith("112233");
    expect(mockChannel.send).toHaveBeenCalledWith("I'm back online! 🟢");
  });

  it("should warn and skip when the channel is not a text channel", async () => {
    const mockChannel = { type: ChannelType.GuildVoice };
    const handler = createReadyHandler("112233");
    const client = createMockClient(mockChannel);

    await handler.execute(client);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("not a valid text channel"),
    );
  });

  it("should warn and skip when the channel is not found", async () => {
    const handler = createReadyHandler("999999");
    const client = createMockClient(null);

    await handler.execute(client);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("not a valid text channel"),
    );
  });
});
