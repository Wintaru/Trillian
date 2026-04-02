import Parser from "rss-parser";
import type { FeedAccessor, FeedSubscriptionRow } from "../accessors/feed-accessor.js";
import * as logger from "../utilities/logger.js";

const parser = new Parser();
const FETCH_TIMEOUT_MS = 15_000;

export interface FeedItem {
  title: string;
  link: string;
  pubDate: string | undefined;
  creator: string | undefined;
  contentSnippet: string | undefined;
  guid: string;
}

export interface NewPostsResult {
  subscription: FeedSubscriptionRow;
  newItems: FeedItem[];
}

export interface AddFeedResult {
  success: boolean;
  reason?: string;
  id?: number;
  latestItem?: FeedItem;
}

export class FeedEngine {
  constructor(private feedAccessor: FeedAccessor) {}

  async addFeed(
    guildId: string,
    channelId: string,
    feedUrl: string,
    label: string,
  ): Promise<AddFeedResult> {
    // Validate the feed is reachable and parseable
    let feed;
    try {
      feed = await parser.parseURL(feedUrl);
    } catch {
      return { success: false, reason: "invalid_feed" };
    }

    let id: number;
    try {
      id = await this.feedAccessor.create(guildId, channelId, feedUrl, label);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
        return { success: false, reason: "duplicate" };
      }
      throw err;
    }

    // Grab the most recent item and store its GUID so we don't re-post on restart
    const latestItem = this.extractLatestItem(feed);
    if (latestItem) {
      await this.feedAccessor.updateLastPost(id, latestItem.guid);
    }

    return { success: true, id, latestItem: latestItem ?? undefined };
  }

  async removeFeed(id: number, guildId: string): Promise<boolean> {
    return this.feedAccessor.remove(id, guildId);
  }

  async listFeeds(guildId: string): Promise<FeedSubscriptionRow[]> {
    return this.feedAccessor.listByGuild(guildId);
  }

  async checkAllFeeds(): Promise<NewPostsResult[]> {
    const subscriptions = await this.feedAccessor.getAll();
    const results: NewPostsResult[] = [];

    for (const sub of subscriptions) {
      try {
        const newItems = await this.checkFeed(sub);
        if (newItems.length > 0) {
          results.push({ subscription: sub, newItems });
        }
      } catch (err) {
        logger.error(`Feed check failed for "${sub.label}" (${sub.feedUrl}):`, err);
        await this.feedAccessor.updateLastChecked(sub.id);
      }
    }

    return results;
  }

  private async checkFeed(sub: FeedSubscriptionRow): Promise<FeedItem[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let feed;
    try {
      feed = await parser.parseURL(sub.feedUrl);
    } finally {
      clearTimeout(timeout);
    }

    if (!feed.items || feed.items.length === 0) {
      await this.feedAccessor.updateLastChecked(sub.id);
      return [];
    }

    const items = feed.items.map((item) => this.toFeedItem(item));

    if (!sub.lastPostGuid) {
      // First check ever — store the latest and don't post anything
      const latest = items[0];
      if (latest) {
        await this.feedAccessor.updateLastPost(sub.id, latest.guid);
      }
      return [];
    }

    // Collect items newer than the last seen GUID
    const newItems: FeedItem[] = [];
    for (const item of items) {
      if (item.guid === sub.lastPostGuid) break;
      newItems.push(item);
    }

    if (newItems.length > 0) {
      await this.feedAccessor.updateLastPost(sub.id, newItems[0].guid);
    } else {
      await this.feedAccessor.updateLastChecked(sub.id);
    }

    // Return in chronological order (oldest first) so they post in order
    return newItems.reverse();
  }

  private extractLatestItem(
    feed: Parser.Output<Record<string, unknown>>,
  ): FeedItem | null {
    if (!feed.items || feed.items.length === 0) return null;
    return this.toFeedItem(feed.items[0]);
  }

  private toFeedItem(item: Parser.Item): FeedItem {
    return {
      title: item.title ?? "Untitled",
      link: item.link ?? "",
      pubDate: item.pubDate,
      creator: item.creator,
      contentSnippet: item.contentSnippet?.slice(0, 300),
      guid: item.guid ?? item.link ?? item.title ?? "",
    };
  }
}
