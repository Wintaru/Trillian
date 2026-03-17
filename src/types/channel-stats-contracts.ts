export interface ChannelStatsRequest {
  guildId: string;
}

export interface MessageContentBreakdown {
  media: number;
  links: number;
}

export interface ChannelStats {
  channelId: string;
  channelName: string;
  totalMessages: number;
  uniquePosters: number;
  topPosters: { userId: string; count: number }[];
  busiestHour: number | null;
  content: MessageContentBreakdown;
}

export interface ServerStatsResponse {
  guildName: string;
  date: string;
  totalMessages: number;
  totalUniquePosters: number;
  topPosters: { userId: string; count: number }[];
  busiestHour: number | null;
  content: MessageContentBreakdown;
  recipesAdded: number;
  libraryEntriesAdded: number;
  channels: ChannelStats[];
}
