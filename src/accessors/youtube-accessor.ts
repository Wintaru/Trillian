import * as logger from "../utilities/logger.js";

const BASE_URL = "https://www.googleapis.com/youtube/v3/search";
const TIMEOUT_MS = 10_000;

interface YouTubeSearchItem {
  id: { videoId?: string };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
}

export class YouTubeAccessor {
  constructor(private readonly apiKey: string) {}

  async searchVideo(query: string): Promise<string | null> {
    try {
      const params = new URLSearchParams({
        part: "snippet",
        q: query,
        type: "video",
        maxResults: "1",
        key: this.apiKey,
      });

      const response = await fetch(`${BASE_URL}?${params}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        logger.warn(`YouTube API returned ${response.status} for query: ${query}`);
        return null;
      }

      const data = (await response.json()) as YouTubeSearchResponse;
      const videoId = data.items?.[0]?.id?.videoId;
      if (!videoId) return null;

      return `https://www.youtube.com/watch?v=${videoId}`;
    } catch (err) {
      logger.warn("YouTube API search failed:", err);
      return null;
    }
  }
}
