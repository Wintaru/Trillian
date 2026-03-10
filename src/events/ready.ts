import { ChannelType, type Client } from "discord.js";
import type { EventHandler } from "../types/event.js";
import * as logger from "../utilities/logger.js";

export function createReadyHandler(
  announceChannelId: string | undefined,
): EventHandler<"clientReady"> {
  return {
    event: "clientReady",
    once: true,

    async execute(client: Client<true>): Promise<void> {
      logger.info(`Logged in as ${client.user.tag}`);

      if (!announceChannelId) return;

      const channel = await client.channels.fetch(announceChannelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        logger.warn(
          `ANNOUNCE_CHANNEL_ID "${announceChannelId}" is not a valid text channel — skipping online announcement.`,
        );
        return;
      }

      await channel.send(`I'm back online! 🟢`);
    },
  };
}
