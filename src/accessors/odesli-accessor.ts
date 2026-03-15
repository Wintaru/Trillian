import type { OdesliLinks } from "../types/music-club-contracts.js";
import * as logger from "../utilities/logger.js";

const BASE_URL = "https://api.song.link/v1-alpha.1/links";
const TIMEOUT_MS = 10_000;

interface OdesliEntity {
  title?: string;
  artistName?: string;
  thumbnailUrl?: string;
}

interface OdesliApiResponse {
  pageUrl: string;
  linksByPlatform: Record<string, { url: string; entityUniqueId: string }>;
  entitiesByUniqueId: Record<string, OdesliEntity>;
}

export interface OdesliResult {
  links: OdesliLinks;
  title: string;
  artist: string;
}

export class OdesliAccessor {
  async getLinks(url: string): Promise<OdesliResult | null> {
    try {
      const encoded = encodeURIComponent(url);
      const response = await fetch(`${BASE_URL}?url=${encoded}&userCountry=US`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        logger.warn(`Odesli API returned ${response.status} for URL: ${url}`);
        return null;
      }

      const data = (await response.json()) as OdesliApiResponse;
      return this.parseResponse(data);
    } catch (err) {
      logger.warn("Odesli API request failed:", err);
      return null;
    }
  }

  private parseResponse(data: OdesliApiResponse): OdesliResult {
    const links: OdesliLinks = {
      pageUrl: data.pageUrl,
    };

    const platformMap: Record<string, keyof OdesliLinks> = {
      spotify: "spotify",
      appleMusic: "appleMusic",
      youtube: "youtube",
      youtubeMusic: "youtube",
      tidal: "tidal",
      amazonMusic: "amazonMusic",
      soundcloud: "soundcloud",
    };

    for (const [platform, key] of Object.entries(platformMap)) {
      const link = data.linksByPlatform[platform];
      if (link && !links[key]) {
        links[key] = link.url;
      }
    }

    // Extract title and artist from the first available entity
    let title = "";
    let artist = "";
    for (const entity of Object.values(data.entitiesByUniqueId)) {
      if (entity.title) {
        title = entity.title;
        artist = entity.artistName ?? "";
        break;
      }
    }

    return { links, title, artist };
  }
}
