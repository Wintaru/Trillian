export interface StarboardEntry {
  id: number;
  guildId: string;
  originalMessageId: string;
  originalChannelId: string;
  originalAuthorId: string;
  authorDisplayName: string;
  messageContent: string;
  starboardMessageId: string | null;
  starCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertStarboardEntryRequest {
  guildId: string;
  originalMessageId: string;
  originalChannelId: string;
  originalAuthorId: string;
  authorDisplayName: string;
  messageContent: string;
  starCount: number;
}

export interface UpsertStarboardEntryResponse {
  entry: StarboardEntry;
  isNew: boolean;
}

export interface UpdateStarCountRequest {
  guildId: string;
  originalMessageId: string;
  starCount: number;
}

export interface SetStarboardMessageIdRequest {
  guildId: string;
  originalMessageId: string;
  starboardMessageId: string;
}
