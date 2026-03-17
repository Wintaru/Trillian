import type { Collection, GuildTextBasedChannel, Message } from "discord.js";

export class ChannelAccessor {
  async fetchMessages(
    channel: GuildTextBasedChannel,
    limit: number,
  ): Promise<Collection<string, Message<true>>> {
    return channel.messages.fetch({ limit });
  }

  async fetchMessagesSince(
    channel: GuildTextBasedChannel,
    since: Date,
  ): Promise<Message<true>[]> {
    const sinceTime = since.getTime();
    const messages: Message<true>[] = [];
    let lastId: string | undefined;

    for (;;) {
      const batch = await channel.messages.fetch({
        limit: 100,
        ...(lastId ? { before: lastId } : {}),
      });

      if (batch.size === 0) break;

      let reachedCutoff = false;
      for (const msg of batch.values()) {
        if (msg.createdTimestamp < sinceTime) {
          reachedCutoff = true;
          break;
        }
        messages.push(msg);
      }

      if (reachedCutoff || batch.size < 100) break;
      lastId = batch.last()!.id;
    }

    return messages;
  }

  async bulkDelete(
    channel: GuildTextBasedChannel,
    messages: Collection<string, Message<true>>,
  ): Promise<number> {
    const deleted = await channel.bulkDelete(messages, true);
    return deleted.size;
  }
}
