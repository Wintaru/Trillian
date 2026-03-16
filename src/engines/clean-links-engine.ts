import type { RedirectAccessor } from "../accessors/redirect-accessor.js";
import type { CleanLinksRequest, CleanLinksResponse, CleanedUrl } from "../types/clean-links-contracts.js";
import * as logger from "../utilities/logger.js";

/** Query parameters to strip (exact match). */
const TRACKING_PARAMS = new Set([
  // Google / UTM (exact names beyond the utm_ prefix catch below)
  "_ga", "_gl", "_gac", "gclid", "gclsrc", "dclid",
  // Facebook / Meta
  "fbclid",
  // Microsoft
  "msclkid",
  // Twitter / X
  "twclid",
  // LinkedIn
  "li_fat_id",
  // Mailchimp
  "mc_cid", "mc_eid",
  // HubSpot
  "__hssc", "__hstc", "__hsfp", "hsCtaTracking",
  // Adobe
  "s_cid", "s_kwcid",
  // Vero
  "vero_id", "vero_conv",
  // Misc ad/affiliate trackers
  "rb_clickid", "wickedid",
  // Instagram
  "igshid",
  // Spotify
  "si",
  // YouTube
  "feature",
  // Referral / attribution
  "ref", "ref_src", "ref_url", "referrer",
  // Omeda
  "oly_anon_id", "oly_enc_id",
]);

/** Query parameter prefixes to strip (startsWith match). */
const TRACKING_PREFIXES = ["utm_", "gad_"];

/** Domains whose URLs are shortened redirects to resolve. */
const SHORTENER_DOMAINS = new Set([
  "bit.ly", "t.co", "tinyurl.com", "ow.ly", "is.gd",
  "buff.ly", "goo.gl", "rb.gy", "short.link", "amzn.to",
]);

const URL_REGEX = /https?:\/\/[^\s<>)"'\]]+/gi;
const MAX_CONCURRENT = 5;

export class CleanLinksEngine {
  constructor(private redirectAccessor: RedirectAccessor) {}

  async clean(request: CleanLinksRequest): Promise<CleanLinksResponse> {
    const rawUrls = this.extractUrls(request.messageContent);
    if (rawUrls.length === 0) {
      return { cleanedUrls: [] };
    }

    // Process URLs with concurrency limit
    const results: CleanedUrl[] = [];
    for (let i = 0; i < rawUrls.length; i += MAX_CONCURRENT) {
      const batch = rawUrls.slice(i, i + MAX_CONCURRENT);
      const batchResults = await Promise.all(batch.map((url) => this.cleanSingleUrl(url)));
      results.push(...batchResults.filter((r): r is CleanedUrl => r !== null));
    }

    return { cleanedUrls: results };
  }

  private async cleanSingleUrl(rawUrl: string): Promise<CleanedUrl | null> {
    try {
      let url = new URL(rawUrl);

      // Resolve shortened URLs first
      if (this.isShortenerDomain(url.hostname)) {
        const resolved = await this.redirectAccessor.resolve(rawUrl);
        if (resolved.didRedirect) {
          url = new URL(resolved.finalUrl);
        }
      }

      const cleaned = this.stripTrackingParams(url);
      const cleanedHref = cleaned.href;

      if (cleanedHref !== rawUrl) {
        return { original: rawUrl, cleaned: cleanedHref };
      }

      return null;
    } catch (error) {
      logger.debug(`Failed to clean URL ${rawUrl}: ${error}`);
      return null;
    }
  }

  extractUrls(text: string): string[] {
    const matches = text.match(URL_REGEX);
    if (!matches) return [];
    // Deduplicate
    return [...new Set(matches)];
  }

  stripTrackingParams(url: URL): URL {
    const cleaned = new URL(url.href);
    const toDelete: string[] = [];

    for (const key of cleaned.searchParams.keys()) {
      if (TRACKING_PARAMS.has(key)) {
        toDelete.push(key);
      } else if (TRACKING_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      cleaned.searchParams.delete(key);
    }

    return cleaned;
  }

  isShortenerDomain(hostname: string): boolean {
    return SHORTENER_DOMAINS.has(hostname);
  }
}
