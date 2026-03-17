import type { Guild, GuildTextBasedChannel, Message } from "discord.js";
import { ChannelType } from "discord.js";
import type { ChannelAccessor } from "../accessors/channel-accessor.js";
import type { ChannelStatsAccessor } from "../accessors/channel-stats-accessor.js";
import type {
  ChannelStatsRequest,
  ServerStatsResponse,
  ChannelStats,
  MessageContentBreakdown,
} from "../types/channel-stats-contracts.js";
import * as logger from "../utilities/logger.js";

const URL_REGEX = /https?:\/\/[^\s<>]+/i;

function startOfDayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function classifyContent(messages: Message<true>[]): MessageContentBreakdown {
  let media = 0;
  let links = 0;

  for (const msg of messages) {
    if (msg.attachments.size > 0) {
      media++;
    }
    if (URL_REGEX.test(msg.content)) {
      links++;
    }
  }

  return { media, links };
}

function computeTopPosters(
  messages: Message<true>[],
  limit: number,
): { userId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const msg of messages) {
    if (msg.author.bot) continue;
    counts.set(msg.author.id, (counts.get(msg.author.id) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([userId, count]) => ({ userId, count }));
}

function computeBusiestHour(messages: Message<true>[]): number | null {
  if (messages.length === 0) return null;

  const hourCounts = new Map<number, number>();
  for (const msg of messages) {
    const hour = new Date(msg.createdTimestamp).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  let busiestHour = 0;
  let maxCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > maxCount) {
      maxCount = count;
      busiestHour = hour;
    }
  }

  return busiestHour;
}

function buildChannelStats(
  channelId: string,
  channelName: string,
  messages: Message<true>[],
): ChannelStats {
  const humanMessages = messages.filter((m) => !m.author.bot);

  return {
    channelId,
    channelName,
    totalMessages: humanMessages.length,
    uniquePosters: new Set(humanMessages.map((m) => m.author.id)).size,
    topPosters: computeTopPosters(messages, 5),
    busiestHour: computeBusiestHour(humanMessages),
    content: classifyContent(humanMessages),
  };
}

export class ChannelStatsEngine {
  constructor(
    private channelAccessor: ChannelAccessor,
    private statsAccessor: ChannelStatsAccessor,
  ) {}

  async generateStats(
    request: ChannelStatsRequest,
    guild: Guild,
  ): Promise<ServerStatsResponse> {
    const today = startOfDayLocal();
    const sinceTimestamp = today.getTime();

    const textChannels = guild.channels.cache.filter(
      (ch): ch is GuildTextBasedChannel =>
        ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement,
    );

    const allMessages: Message<true>[] = [];
    const channelStatsList: ChannelStats[] = [];

    for (const [, channel] of textChannels) {
      try {
        const messages = await this.channelAccessor.fetchMessagesSince(channel, today);
        if (messages.length === 0) continue;

        allMessages.push(...messages);
        channelStatsList.push(buildChannelStats(channel.id, channel.name, messages));
      } catch (err) {
        logger.warn(`Could not fetch messages from #${channel.name}: ${err}`);
      }
    }

    channelStatsList.sort((a, b) => b.totalMessages - a.totalMessages);

    const humanMessages = allMessages.filter((m) => !m.author.bot);

    const [recipesAdded, libraryEntriesAdded] = await Promise.all([
      this.statsAccessor.countRecipesSince(request.guildId, sinceTimestamp),
      this.statsAccessor.countLibraryEntriesSince(request.guildId, sinceTimestamp),
    ]);

    const dateStr = today.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return {
      guildName: guild.name,
      date: dateStr,
      totalMessages: humanMessages.length,
      totalUniquePosters: new Set(humanMessages.map((m) => m.author.id)).size,
      topPosters: computeTopPosters(allMessages, 10),
      busiestHour: computeBusiestHour(humanMessages),
      content: classifyContent(humanMessages),
      recipesAdded,
      libraryEntriesAdded,
      channels: channelStatsList,
    };
  }
}
