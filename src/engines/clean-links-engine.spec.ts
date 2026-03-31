import { describe, it, expect, vi, beforeEach } from "vitest";
import { CleanLinksEngine } from "./clean-links-engine.js";
import type { RedirectAccessor } from "../accessors/redirect-accessor.js";

function createMockRedirectAccessor(): RedirectAccessor {
  return {
    resolve: vi.fn(),
  } as unknown as RedirectAccessor;
}

describe("CleanLinksEngine", () => {
  let engine: CleanLinksEngine;
  let mockAccessor: RedirectAccessor;

  beforeEach(() => {
    mockAccessor = createMockRedirectAccessor();
    engine = new CleanLinksEngine(mockAccessor);
  });

  describe("extractUrls", () => {
    it("should extract a single URL", () => {
      const urls = engine.extractUrls("Check out https://example.com/page");
      expect(urls).toEqual(["https://example.com/page"]);
    });

    it("should extract multiple URLs", () => {
      const urls = engine.extractUrls("See https://a.com and http://b.com/test");
      expect(urls).toEqual(["https://a.com", "http://b.com/test"]);
    });

    it("should return empty array for no URLs", () => {
      const urls = engine.extractUrls("No links here");
      expect(urls).toEqual([]);
    });

    it("should deduplicate identical URLs", () => {
      const urls = engine.extractUrls("https://a.com and https://a.com again");
      expect(urls).toEqual(["https://a.com"]);
    });
  });

  describe("stripTrackingParams", () => {
    it("should strip utm_ parameters", () => {
      const url = new URL("https://example.com/page?utm_source=twitter&utm_medium=social&q=test");
      const cleaned = engine.stripTrackingParams(url);
      expect(cleaned.searchParams.has("utm_source")).toBe(false);
      expect(cleaned.searchParams.has("utm_medium")).toBe(false);
      expect(cleaned.searchParams.get("q")).toBe("test");
    });

    it("should strip fbclid", () => {
      const url = new URL("https://example.com/page?fbclid=abc123&id=5");
      const cleaned = engine.stripTrackingParams(url);
      expect(cleaned.searchParams.has("fbclid")).toBe(false);
      expect(cleaned.searchParams.get("id")).toBe("5");
    });

    it("should strip gclid and msclkid", () => {
      const url = new URL("https://example.com?gclid=abc&msclkid=def");
      const cleaned = engine.stripTrackingParams(url);
      expect(cleaned.searchParams.has("gclid")).toBe(false);
      expect(cleaned.searchParams.has("msclkid")).toBe(false);
    });

    it("should strip YouTube si and feature params", () => {
      const url = new URL("https://youtube.com/watch?v=dQw4w9WgXcQ&si=abc123&feature=shared");
      const cleaned = engine.stripTrackingParams(url);
      expect(cleaned.searchParams.get("v")).toBe("dQw4w9WgXcQ");
      expect(cleaned.searchParams.has("si")).toBe(false);
      expect(cleaned.searchParams.has("feature")).toBe(false);
    });

    it("should strip Spotify si param", () => {
      const url = new URL("https://open.spotify.com/track/abc?si=xyz123");
      const cleaned = engine.stripTrackingParams(url);
      expect(cleaned.searchParams.has("si")).toBe(false);
      expect(cleaned.pathname).toBe("/track/abc");
    });

    it("should preserve non-tracking parameters", () => {
      const url = new URL("https://example.com/search?q=hello+world&page=2");
      const cleaned = engine.stripTrackingParams(url);
      expect(cleaned.searchParams.get("q")).toBe("hello world");
      expect(cleaned.searchParams.get("page")).toBe("2");
    });

    it("should handle URL with no query parameters", () => {
      const url = new URL("https://example.com/page");
      const cleaned = engine.stripTrackingParams(url);
      expect(cleaned.href).toBe("https://example.com/page");
    });

    it("should remove entire query string when all params are tracking", () => {
      const url = new URL("https://example.com/page?utm_source=twitter&fbclid=abc");
      const cleaned = engine.stripTrackingParams(url);
      expect(cleaned.search).toBe("");
    });

    it("should preserve fragment identifiers", () => {
      const url = new URL("https://example.com/page?utm_source=twitter#section-2");
      const cleaned = engine.stripTrackingParams(url);
      expect(cleaned.hash).toBe("#section-2");
      expect(cleaned.searchParams.has("utm_source")).toBe(false);
    });

    it("should strip HubSpot tracking params", () => {
      const url = new URL("https://example.com?__hssc=abc&__hstc=def&__hsfp=ghi");
      const cleaned = engine.stripTrackingParams(url);
      expect(cleaned.searchParams.has("__hssc")).toBe(false);
      expect(cleaned.searchParams.has("__hstc")).toBe(false);
      expect(cleaned.searchParams.has("__hsfp")).toBe(false);
    });

    it("should strip Google Analytics params", () => {
      const url = new URL("https://example.com?_ga=abc&_gl=def");
      const cleaned = engine.stripTrackingParams(url);
      expect(cleaned.searchParams.has("_ga")).toBe(false);
      expect(cleaned.searchParams.has("_gl")).toBe(false);
    });

    it("should strip Google Ads gad_ params", () => {
      const url = new URL("https://example.com/page?gad_source=1&gad_campaignid=123&id=5");
      const cleaned = engine.stripTrackingParams(url);
      expect(cleaned.searchParams.has("gad_source")).toBe(false);
      expect(cleaned.searchParams.has("gad_campaignid")).toBe(false);
      expect(cleaned.searchParams.get("id")).toBe("5");
    });
  });

  describe("isShortenerDomain", () => {
    it("should identify bit.ly as a shortener", () => {
      expect(engine.isShortenerDomain("bit.ly")).toBe(true);
    });

    it("should identify t.co as a shortener", () => {
      expect(engine.isShortenerDomain("t.co")).toBe(true);
    });

    it("should not flag regular domains", () => {
      expect(engine.isShortenerDomain("example.com")).toBe(false);
      expect(engine.isShortenerDomain("youtube.com")).toBe(false);
    });
  });

  describe("clean", () => {
    it("should return empty array when no URLs in message", async () => {
      const result = await engine.clean({ messageContent: "No links here" });
      expect(result.cleanedUrls).toEqual([]);
    });

    it("should return empty array when URLs have no tracking params", async () => {
      const result = await engine.clean({
        messageContent: "Check https://example.com/page",
      });
      expect(result.cleanedUrls).toEqual([]);
    });

    it("should clean a URL with tracking params", async () => {
      const result = await engine.clean({
        messageContent: "Check https://example.com/page?utm_source=twitter&q=test",
      });
      expect(result.cleanedUrls).toHaveLength(1);
      expect(result.cleanedUrls[0].original).toBe("https://example.com/page?utm_source=twitter&q=test");
      expect(result.cleanedUrls[0].cleaned).toBe("https://example.com/page?q=test");
    });

    it("should resolve shortened URLs then strip params", async () => {
      vi.mocked(mockAccessor.resolve).mockResolvedValue({
        originalUrl: "https://bit.ly/abc123",
        finalUrl: "https://example.com/article?utm_source=bitly&id=42",
        didRedirect: true,
      });

      const result = await engine.clean({
        messageContent: "Read this: https://bit.ly/abc123",
      });

      expect(mockAccessor.resolve).toHaveBeenCalledWith("https://bit.ly/abc123");
      expect(result.cleanedUrls).toHaveLength(1);
      expect(result.cleanedUrls[0].cleaned).toBe("https://example.com/article?id=42");
    });

    it("should handle multiple URLs in one message", async () => {
      const result = await engine.clean({
        messageContent:
          "https://a.com/page?fbclid=abc and https://b.com/page?utm_source=x",
      });
      expect(result.cleanedUrls).toHaveLength(2);
    });

    it("should skip URLs that fail to parse", async () => {
      const result = await engine.clean({
        messageContent: "Check https://example.com/page?q=test",
      });
      expect(result.cleanedUrls).toEqual([]);
    });

    it("should not treat URL normalization as cleaning", async () => {
      const result = await engine.clean({
        messageContent: "Check https://www.omahazoo.com/owen-sea-lion-shores/",
      });
      expect(result.cleanedUrls).toEqual([]);
    });

    it("should not treat trailing slash normalization as cleaning", async () => {
      const result = await engine.clean({
        messageContent: "Visit https://example.com",
      });
      expect(result.cleanedUrls).toEqual([]);
    });

    it("should not resolve non-shortener domains", async () => {
      await engine.clean({
        messageContent: "https://youtube.com/watch?v=abc&utm_source=share",
      });
      expect(mockAccessor.resolve).not.toHaveBeenCalled();
    });
  });
});
