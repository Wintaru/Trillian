import { describe, it, expect, vi, beforeEach } from "vitest";
import { FeedEngine } from "./feed-engine.js";
import type { FeedAccessor, FeedSubscriptionRow } from "../accessors/feed-accessor.js";
import Parser from "rss-parser";

vi.mock("rss-parser");

function createMockAccessor(): FeedAccessor {
  return {
    create: vi.fn(),
    remove: vi.fn(),
    listByGuild: vi.fn(),
    getAll: vi.fn(),
    updateLastPost: vi.fn(),
    updateLastChecked: vi.fn(),
  } as unknown as FeedAccessor;
}

function makeSub(overrides: Partial<FeedSubscriptionRow> = {}): FeedSubscriptionRow {
  return {
    id: 1,
    guildId: "guild-1",
    channelId: "channel-1",
    feedUrl: "https://example.com/rss/",
    label: "Test Feed",
    lastPostGuid: null,
    lastCheckedAt: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("FeedEngine", () => {
  let accessor: FeedAccessor;
  let engine: FeedEngine;

  beforeEach(() => {
    accessor = createMockAccessor();
    engine = new FeedEngine(accessor);
    vi.restoreAllMocks();
  });

  describe("addFeed", () => {
    it("should add a valid feed and store latest GUID", async () => {
      vi.mocked(Parser.prototype.parseURL).mockResolvedValue({
        items: [
          { title: "Post 1", link: "https://example.com/1", guid: "guid-1", pubDate: "2026-04-01" },
        ],
      } as Parser.Output<Record<string, unknown>>);
      vi.mocked(accessor.create).mockResolvedValue(5);

      const result = await engine.addFeed("guild-1", "channel-1", "https://example.com/rss/", "My Blog");

      expect(result.success).toBe(true);
      expect(result.id).toBe(5);
      expect(result.latestItem).toBeDefined();
      expect(result.latestItem!.title).toBe("Post 1");
      expect(accessor.updateLastPost).toHaveBeenCalledWith(5, "guid-1");
    });

    it("should return invalid_feed when URL is not parseable", async () => {
      vi.mocked(Parser.prototype.parseURL).mockRejectedValue(new Error("bad feed"));

      const result = await engine.addFeed("guild-1", "channel-1", "https://bad.url/", "Bad");

      expect(result).toEqual({ success: false, reason: "invalid_feed" });
      expect(accessor.create).not.toHaveBeenCalled();
    });

    it("should return duplicate when feed already subscribed", async () => {
      vi.mocked(Parser.prototype.parseURL).mockResolvedValue({
        items: [{ title: "Post", link: "https://example.com/1", guid: "guid-1" }],
      } as Parser.Output<Record<string, unknown>>);
      vi.mocked(accessor.create).mockRejectedValue(new Error("UNIQUE constraint failed"));

      const result = await engine.addFeed("guild-1", "channel-1", "https://example.com/rss/", "Dup");

      expect(result).toEqual({ success: false, reason: "duplicate" });
    });

    it("should handle feed with no items", async () => {
      vi.mocked(Parser.prototype.parseURL).mockResolvedValue({
        items: [],
      } as Parser.Output<Record<string, unknown>>);
      vi.mocked(accessor.create).mockResolvedValue(10);

      const result = await engine.addFeed("guild-1", "channel-1", "https://example.com/rss/", "Empty");

      expect(result.success).toBe(true);
      expect(result.latestItem).toBeUndefined();
      expect(accessor.updateLastPost).not.toHaveBeenCalled();
    });
  });

  describe("removeFeed", () => {
    it("should delegate to accessor", async () => {
      vi.mocked(accessor.remove).mockResolvedValue(true);

      const result = await engine.removeFeed(3, "guild-1");

      expect(result).toBe(true);
      expect(accessor.remove).toHaveBeenCalledWith(3, "guild-1");
    });

    it("should return false when not found", async () => {
      vi.mocked(accessor.remove).mockResolvedValue(false);

      const result = await engine.removeFeed(999, "guild-1");

      expect(result).toBe(false);
    });
  });

  describe("listFeeds", () => {
    it("should return feeds for guild", async () => {
      const feeds = [makeSub()];
      vi.mocked(accessor.listByGuild).mockResolvedValue(feeds);

      const result = await engine.listFeeds("guild-1");

      expect(result).toEqual(feeds);
      expect(accessor.listByGuild).toHaveBeenCalledWith("guild-1");
    });
  });

  describe("checkAllFeeds", () => {
    it("should return new items when feed has posts after lastPostGuid", async () => {
      vi.mocked(accessor.getAll).mockResolvedValue([
        makeSub({ id: 1, lastPostGuid: "guid-old" }),
      ]);
      vi.mocked(Parser.prototype.parseURL).mockResolvedValue({
        items: [
          { title: "New Post", link: "https://example.com/new", guid: "guid-new" },
          { title: "Old Post", link: "https://example.com/old", guid: "guid-old" },
        ],
      } as Parser.Output<Record<string, unknown>>);

      const results = await engine.checkAllFeeds();

      expect(results).toHaveLength(1);
      expect(results[0].newItems).toHaveLength(1);
      expect(results[0].newItems[0].title).toBe("New Post");
      expect(accessor.updateLastPost).toHaveBeenCalledWith(1, "guid-new");
    });

    it("should return empty when no new posts", async () => {
      vi.mocked(accessor.getAll).mockResolvedValue([
        makeSub({ id: 1, lastPostGuid: "guid-1" }),
      ]);
      vi.mocked(Parser.prototype.parseURL).mockResolvedValue({
        items: [
          { title: "Same Post", link: "https://example.com/1", guid: "guid-1" },
        ],
      } as Parser.Output<Record<string, unknown>>);

      const results = await engine.checkAllFeeds();

      expect(results).toHaveLength(0);
      expect(accessor.updateLastChecked).toHaveBeenCalledWith(1);
    });

    it("should store latest GUID on first check (no lastPostGuid) and not return items", async () => {
      vi.mocked(accessor.getAll).mockResolvedValue([
        makeSub({ id: 1, lastPostGuid: null }),
      ]);
      vi.mocked(Parser.prototype.parseURL).mockResolvedValue({
        items: [
          { title: "Post", link: "https://example.com/1", guid: "guid-1" },
        ],
      } as Parser.Output<Record<string, unknown>>);

      const results = await engine.checkAllFeeds();

      expect(results).toHaveLength(0);
      expect(accessor.updateLastPost).toHaveBeenCalledWith(1, "guid-1");
    });

    it("should handle feed parse failure gracefully", async () => {
      vi.mocked(accessor.getAll).mockResolvedValue([
        makeSub({ id: 1, lastPostGuid: "guid-1" }),
      ]);
      vi.mocked(Parser.prototype.parseURL).mockRejectedValue(new Error("network error"));

      const results = await engine.checkAllFeeds();

      expect(results).toHaveLength(0);
      expect(accessor.updateLastChecked).toHaveBeenCalledWith(1);
    });

    it("should return multiple new items in chronological order", async () => {
      vi.mocked(accessor.getAll).mockResolvedValue([
        makeSub({ id: 1, lastPostGuid: "guid-old" }),
      ]);
      vi.mocked(Parser.prototype.parseURL).mockResolvedValue({
        items: [
          { title: "Newest", link: "https://example.com/3", guid: "guid-3" },
          { title: "Middle", link: "https://example.com/2", guid: "guid-2" },
          { title: "Old", link: "https://example.com/old", guid: "guid-old" },
        ],
      } as Parser.Output<Record<string, unknown>>);

      const results = await engine.checkAllFeeds();

      expect(results[0].newItems).toHaveLength(2);
      expect(results[0].newItems[0].title).toBe("Middle"); // oldest first
      expect(results[0].newItems[1].title).toBe("Newest");
    });
  });
});
