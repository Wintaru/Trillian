import { describe, it, expect, vi, beforeEach } from "vitest";
import { Collection } from "discord.js";
import type { GuildTextBasedChannel, Message } from "discord.js";
import { ChannelEngine } from "./channel-engine.js";
import type { ChannelAccessor } from "../accessors/channel-accessor.js";

function createMockAccessor(): ChannelAccessor {
  return {
    fetchMessages: vi.fn(),
    bulkDelete: vi.fn(),
  } as unknown as ChannelAccessor;
}

function createMockChannel(): GuildTextBasedChannel {
  return {} as GuildTextBasedChannel;
}

function createMessages(count: number): Collection<string, Message<true>> {
  const col = new Collection<string, Message<true>>();
  for (let i = 0; i < count; i++) {
    col.set(`msg-${i}`, { id: `msg-${i}` } as Message<true>);
  }
  return col;
}

describe("ChannelEngine", () => {
  let accessor: ChannelAccessor;
  let engine: ChannelEngine;
  let channel: GuildTextBasedChannel;

  beforeEach(() => {
    accessor = createMockAccessor();
    engine = new ChannelEngine(accessor);
    channel = createMockChannel();
  });

  it("should purge messages and return counts", async () => {
    const messages = createMessages(10);
    vi.mocked(accessor.fetchMessages).mockResolvedValue(messages);
    vi.mocked(accessor.bulkDelete).mockResolvedValue(10);

    const response = await engine.purge({ channelId: "123", count: 10 }, channel);

    expect(response.deletedCount).toBe(10);
    expect(response.skippedCount).toBe(0);
    expect(response.errors).toHaveLength(0);
  });

  it("should handle partially skipped messages (older than 14 days)", async () => {
    const fetched = createMessages(10);
    vi.mocked(accessor.fetchMessages).mockResolvedValue(fetched);
    vi.mocked(accessor.bulkDelete).mockResolvedValue(7);

    const response = await engine.purge({ channelId: "123", count: 10 }, channel);

    expect(response.deletedCount).toBe(7);
    expect(response.skippedCount).toBe(3);
  });

  it("should stop when no messages are returned", async () => {
    const empty = new Collection<string, Message<true>>();
    vi.mocked(accessor.fetchMessages).mockResolvedValue(empty);

    const response = await engine.purge({ channelId: "123", count: 50 }, channel);

    expect(response.deletedCount).toBe(0);
    expect(accessor.fetchMessages).toHaveBeenCalledTimes(1);
  });

  it("should stop when bulk delete returns nothing (all too old)", async () => {
    const messages = createMessages(10);
    vi.mocked(accessor.fetchMessages).mockResolvedValue(messages);
    vi.mocked(accessor.bulkDelete).mockResolvedValue(0);

    const response = await engine.purge({ channelId: "123", count: 50 }, channel);

    expect(response.deletedCount).toBe(0);
    expect(response.skippedCount).toBe(10);
  });

  it("should capture errors and stop", async () => {
    vi.mocked(accessor.fetchMessages).mockRejectedValue(new Error("API error"));

    const response = await engine.purge({ channelId: "123", count: 10 }, channel);

    expect(response.errors).toContain("API error");
    expect(response.deletedCount).toBe(0);
  });

  it("should batch large purge requests", async () => {
    const batch = createMessages(100);
    const empty = new Collection<string, Message<true>>();
    vi.mocked(accessor.fetchMessages)
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce(empty);
    vi.mocked(accessor.bulkDelete).mockResolvedValue(100);

    const response = await engine.purge({ channelId: "123", count: 250 }, channel);

    expect(response.deletedCount).toBe(200);
    expect(accessor.fetchMessages).toHaveBeenCalledTimes(3);
  });
});
