import * as logger from "../utilities/logger.js";

const TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 10;
const USER_AGENT = "Trillian-Bot/1.0 (link cleaner)";

export interface ResolvedUrl {
  originalUrl: string;
  finalUrl: string;
  didRedirect: boolean;
}

export class RedirectAccessor {
  async resolve(url: string): Promise<ResolvedUrl> {
    let current = url;

    for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(current, {
          method: "HEAD",
          headers: { "User-Agent": USER_AGENT },
          redirect: "manual",
          signal: controller.signal,
        });

        const location = response.headers.get("location");
        if (!location || response.status < 300 || response.status >= 400) {
          return { originalUrl: url, finalUrl: current, didRedirect: current !== url };
        }

        // Resolve relative redirects against current URL
        current = new URL(location, current).href;
      } catch (error) {
        logger.debug(`Redirect resolution failed for ${url}: ${error}`);
        return { originalUrl: url, finalUrl: current, didRedirect: current !== url };
      } finally {
        clearTimeout(timeout);
      }
    }

    return { originalUrl: url, finalUrl: current, didRedirect: current !== url };
  }
}
