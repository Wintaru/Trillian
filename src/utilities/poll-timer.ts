import type { Client, TextBasedChannel } from "discord.js";
import type { PollEngine } from "../engines/poll-engine.js";
import { buildPollEmbed } from "./poll-embed.js";
import * as logger from "./logger.js";

const CHECK_INTERVAL_MS = 30_000;

export function startPollTimer(client: Client, pollEngine: PollEngine): void {
  setInterval(async () => {
    try {
      const expired = await pollEngine.closeExpiredPolls();

      for (const poll of expired) {
        try {
          const channel = await client.channels.fetch(poll.channelId);
          if (!channel?.isTextBased()) continue;

          const message = await (channel as TextBasedChannel).messages.fetch(poll.messageId);
          const results = await pollEngine.getPollResults({ pollId: poll.id });

          if (results) {
            await message.edit({
              embeds: [buildPollEmbed(results)],
              components: [],
            });
          }
        } catch (err) {
          logger.error(`Failed to update expired poll ${poll.id}:`, err);
        }
      }
    } catch (err) {
      logger.error("Poll timer error:", err);
    }
  }, CHECK_INTERVAL_MS);
}
