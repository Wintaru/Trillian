import { describe, it, expect, vi } from "vitest";
import { Collection } from "discord.js";
import type { GuildTextBasedChannel, Message } from "discord.js";
import { ChannelAccessor } from "./channel-accessor.js";

function createMockChannel(): GuildTextBasedChannel {
  return {
    messages: {
      fetch: vi.fn(),
    },
    bulkDelete: vi.fn(),
  } as unknown as GuildTextBasedChannel;
}

describe("ChannelAccessor", () => {
  const accessor = new ChannelAccessor();

  it("should fetch messages with the given limit", async () => {
    const channel = createMockChannel();
    const messages = new Collection<string, Message<true>>();
    vi.mocked(channel.messages.fetch).mockResolvedValue(messages);

    const result = await accessor.fetchMessages(channel, 50);

    expect(channel.messages.fetch).toHaveBeenCalledWith({ limit: 50 });
    expect(result).toBe(messages);
  });

  it("should bulk delete messages and return count", async () => {
    const channel = createMockChannel();
    const messages = new Collection<string, Message<true>>();
    const deleted = new Collection<string, Message | undefined>();
    deleted.set("1", {} as Message);
    deleted.set("2", {} as Message);
    vi.mocked(channel.bulkDelete).mockResolvedValue(deleted);

    const result = await accessor.bulkDelete(channel, messages);

    expect(channel.bulkDelete).toHaveBeenCalledWith(messages, true);
    expect(result).toBe(2);
  });
});
