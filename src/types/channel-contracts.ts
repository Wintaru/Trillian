export interface PurgeRequest {
  channelId: string;
  count?: number;
}

export interface PurgeResponse {
  deletedCount: number;
  skippedCount: number;
  errors: string[];
}
