import type { Collection, GuildTextBasedChannel, Message } from "discord.js";

export class ChannelAccessor {
  async fetchMessages(
    channel: GuildTextBasedChannel,
    limit: number,
  ): Promise<Collection<string, Message<true>>> {
    return channel.messages.fetch({ limit });
  }

  async bulkDelete(
    channel: GuildTextBasedChannel,
    messages: Collection<string, Message<true>>,
  ): Promise<number> {
    const deleted = await channel.bulkDelete(messages, true);
    return deleted.size;
  }
}
