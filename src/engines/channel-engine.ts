import type { GuildTextBasedChannel } from "discord.js";
import type { ChannelAccessor } from "../accessors/channel-accessor.js";
import type { PurgeRequest, PurgeResponse } from "../types/channel-contracts.js";
import * as logger from "../utilities/logger.js";

const MAX_BULK_DELETE = 100;
const DEFAULT_PURGE_COUNT = 100;

export class ChannelEngine {
  constructor(private channelAccessor: ChannelAccessor) {}

  async purge(request: PurgeRequest, channel: GuildTextBasedChannel): Promise<PurgeResponse> {
    const count = request.count ?? DEFAULT_PURGE_COUNT;
    let deletedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    let remaining = count;

    while (remaining > 0) {
      const batchSize = Math.min(remaining, MAX_BULK_DELETE);

      try {
        const messages = await this.channelAccessor.fetchMessages(channel, batchSize);
        if (messages.size === 0) break;

        const batchDeleted = await this.channelAccessor.bulkDelete(channel, messages);
        const batchSkipped = messages.size - batchDeleted;

        deletedCount += batchDeleted;
        skippedCount += batchSkipped;
        remaining -= messages.size;

        // If we fetched fewer than requested, there are no more messages
        if (messages.size < batchSize) break;
        // If nothing was deleted (all too old), stop to avoid infinite loop
        if (batchDeleted === 0) break;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(`Purge batch failed: ${errorMessage}`);
        errors.push(errorMessage);
        break;
      }
    }

    return { deletedCount, skippedCount, errors };
  }
}
