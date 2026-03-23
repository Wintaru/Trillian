import * as logger from "../utilities/logger.js";

const TIMEOUT_MS = 10_000;

export interface SongMetadata {
  title: string;
  artist: string;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

function extractMeta(html: string, attrName: string, attrValue: string): string {
  // Use a lookahead to find the <meta> tag containing the target attribute, then pull content=
  const re = new RegExp(
    `<meta(?=[^>]*\\s${attrName}=["']${attrValue}["'])[^>]*>`,
    "gi",
  );
  const tagMatch = re.exec(html);
  if (!tagMatch) return "";
  const contentMatch = tagMatch[0].match(/\scontent=["']([^"']*?)["']/i);
  return decodeEntities((contentMatch?.[1] ?? "").trim());
}

function extractPageTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return decodeEntities((m?.[1] ?? "").trim());
}

export function parseMetadata(html: string, url: string): SongMetadata {
  const ogTitle = extractMeta(html, "property", "og:title");
  const pageTitle = extractPageTitle(html);

  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    // ignore invalid urls
  }

  let title = ogTitle;
  let artist = "";

  if (hostname.includes("spotify.com") && pageTitle) {
    // "<Title> - song by <Artist> | Spotify" or "- song and lyrics by <Artist>"
    const m = pageTitle.match(/^(.+?)\s*[-–]\s*song(?:\s+and\s+lyrics)?\s+by\s+(.+?)(?:\s*[|·]|$)/i);
    if (m) {
      if (!title) title = m[1].trim();
      artist = m[2].trim();
    }
  } else if (hostname.includes("music.apple.com") && pageTitle) {
    // "Title — Artist - Apple Music" or "Title - Artist"
    const m = pageTitle.match(/^(.+?)\s*[—–]\s*(.+?)(?:\s*[-–]\s*Apple|$)/i);
    if (m) {
      if (!title) title = m[1].trim();
      artist = m[2].trim();
    }
  } else if (hostname.includes("tidal.com") && pageTitle) {
    // "Title - Artist | TIDAL"
    const m = pageTitle.match(/^(.+?)\s*[-–]\s*(.+?)\s*[|·]/i);
    if (m) {
      if (!title) title = m[1].trim();
      artist = m[2].trim();
    }
  }

  return {
    title: title || pageTitle,
    artist,
  };
}

export class SongMetadataAccessor {
  async getMetadata(url: string): Promise<SongMetadata | null> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Trillian-Bot/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "follow",
      });

      if (!response.ok) {
        logger.warn(`Song metadata fetch returned ${response.status} for ${url}`);
        return null;
      }

      const html = await response.text();
      const metadata = parseMetadata(html, url);

      if (!metadata.title) {
        logger.warn(`No title found for ${url}`);
        return null;
      }

      return metadata;
    } catch (err) {
      logger.warn(`Song metadata fetch failed for ${url}:`, err);
      return null;
    }
  }
}
