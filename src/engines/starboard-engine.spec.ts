import { describe, it, expect, vi, beforeEach } from "vitest";
import { StarboardEngine } from "./starboard-engine.js";
import type { StarboardAccessor } from "../accessors/starboard-accessor.js";
import type { StarboardEntry } from "../types/starboard-contracts.js";
import type { MessageReaction, Message, TextChannel, Guild, Collection, Attachment } from "discord.js";

function createMockAccessor(): StarboardAccessor {
  return {
    getEntry: vi.fn(),
    upsertEntry: vi.fn(),
    setStarboardMessageId: vi.fn(),
    updateStarCount: vi.fn(),
  } as unknown as StarboardAccessor;
}

function createMockMessage(overrides: Partial<{
  id: string;
  content: string;
  authorId: string;
  authorBot: boolean;
  guildId: string;
  channelId: string;
  displayName: string;
  createdAt: Date;
}>): Message {
  const opts = {
    id: "msg-1",
    content: "test message",
    authorId: "author-1",
    authorBot: false,
    guildId: "guild-1",
    channelId: "channel-1",
    displayName: "TestUser",
    createdAt: new Date("2026-01-15T12:00:00Z"),
    ...overrides,
  };

  const attachments = new Map() as unknown as Collection<string, Attachment>;
  attachments.find = vi.fn().mockReturnValue(undefined);

  return {
    id: opts.id,
    content: opts.content,
    channelId: opts.channelId,
    createdAt: opts.createdAt,
    partial: false,
    reference: null,
    channel: {
      messages: { fetch: vi.fn() },
    },
    author: {
      id: opts.authorId,
      bot: opts.authorBot,
      displayName: opts.displayName,
      displayAvatarURL: vi.fn().mockReturnValue("https://cdn.discordapp.com/avatar.png"),
    },
    member: {
      displayName: opts.displayName,
    },
    guild: {
      id: opts.guildId,
      channels: {
        fetch: vi.fn(),
      },
      members: {
        fetch: vi.fn(),
      },
    },
    attachments,
  } as unknown as Message;
}

function createMockReaction(message: Message, count: number): MessageReaction {
  return {
    partial: false,
    emoji: { name: "⭐" },
    message,
    count,
    fetch: vi.fn(),
  } as unknown as MessageReaction;
}

const STARBOARD_CHANNEL_ID = "starboard-ch";

describe("StarboardEngine", () => {
  let accessor: StarboardAccessor;
  let engine: StarboardEngine;

  beforeEach(() => {
    accessor = createMockAccessor();
    engine = new StarboardEngine(accessor, 3);
  });

  it("should ignore non-star reactions", async () => {
    const message = createMockMessage({});
    const reaction = {
      partial: false,
      emoji: { name: "👍" },
      message,
      count: 5,
    } as unknown as MessageReaction;

    await engine.handleReactionUpdate(reaction, STARBOARD_CHANNEL_ID);

    expect(accessor.upsertEntry).not.toHaveBeenCalled();
  });

  it("should ignore bot messages", async () => {
    const message = createMockMessage({ authorBot: true });
    const reaction = createMockReaction(message, 3);

    await engine.handleReactionUpdate(reaction, STARBOARD_CHANNEL_ID);

    expect(accessor.upsertEntry).not.toHaveBeenCalled();
  });

  it("should ignore messages without a guild", async () => {
    const message = createMockMessage({});
    (message as unknown as Record<string, unknown>).guild = null;
    const reaction = createMockReaction(message, 3);

    await engine.handleReactionUpdate(reaction, STARBOARD_CHANNEL_ID);

    expect(accessor.upsertEntry).not.toHaveBeenCalled();
  });

  it("should upsert entry and post to starboard when threshold met", async () => {
    const message = createMockMessage({});
    const reaction = createMockReaction(message, 3);

    const entry: StarboardEntry = {
      id: 1,
      guildId: "guild-1",
      originalMessageId: "msg-1",
      originalChannelId: "channel-1",
      originalAuthorId: "author-1",
      authorDisplayName: "TestUser",
      messageContent: "test message",
      starboardMessageId: null,
      starCount: 3,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    vi.mocked(accessor.upsertEntry).mockResolvedValue({ entry, isNew: true });

    const mockSend = vi.fn().mockResolvedValue({ id: "starboard-msg-1" });
    const mockStarboardChannel = { isTextBased: () => true, send: mockSend } as unknown as TextChannel;
    vi.mocked(message.guild!.channels.fetch).mockResolvedValue(mockStarboardChannel as never);

    await engine.handleReactionUpdate(reaction, STARBOARD_CHANNEL_ID);

    expect(accessor.upsertEntry).toHaveBeenCalledWith(
      "guild-1", "msg-1", "channel-1", "author-1", "TestUser", "test message", 3,
    );
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(accessor.setStarboardMessageId).toHaveBeenCalledWith("guild-1", "msg-1", "starboard-msg-1");
  });

  it("should not post when below threshold", async () => {
    const message = createMockMessage({});
    const reaction = createMockReaction(message, 2);

    const entry: StarboardEntry = {
      id: 1,
      guildId: "guild-1",
      originalMessageId: "msg-1",
      originalChannelId: "channel-1",
      originalAuthorId: "author-1",
      authorDisplayName: "TestUser",
      messageContent: "test message",
      starboardMessageId: null,
      starCount: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    vi.mocked(accessor.upsertEntry).mockResolvedValue({ entry, isNew: true });

    await engine.handleReactionUpdate(reaction, STARBOARD_CHANNEL_ID);

    expect(accessor.upsertEntry).toHaveBeenCalled();
    // Should not try to fetch the starboard channel since no message to post/update
    expect(message.guild!.channels.fetch).not.toHaveBeenCalled();
  });

  it("should update existing starboard message when stars change", async () => {
    const message = createMockMessage({});
    const reaction = createMockReaction(message, 5);

    const entry: StarboardEntry = {
      id: 1,
      guildId: "guild-1",
      originalMessageId: "msg-1",
      originalChannelId: "channel-1",
      originalAuthorId: "author-1",
      authorDisplayName: "TestUser",
      messageContent: "test message",
      starboardMessageId: "existing-sb-msg",
      starCount: 5,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    vi.mocked(accessor.upsertEntry).mockResolvedValue({ entry, isNew: false });

    const mockEdit = vi.fn().mockResolvedValue({});
    const mockFetchMessages = vi.fn().mockResolvedValue({ id: "existing-sb-msg", edit: mockEdit });
    const mockStarboardChannel = {
      isTextBased: () => true,
      messages: { fetch: mockFetchMessages },
    } as unknown as TextChannel;
    vi.mocked(message.guild!.channels.fetch).mockResolvedValue(mockStarboardChannel as never);

    await engine.handleReactionUpdate(reaction, STARBOARD_CHANNEL_ID);

    expect(mockFetchMessages).toHaveBeenCalledWith("existing-sb-msg");
    expect(mockEdit).toHaveBeenCalledTimes(1);
  });

  it("should re-post if existing starboard message was deleted", async () => {
    const message = createMockMessage({});
    const reaction = createMockReaction(message, 4);

    const entry: StarboardEntry = {
      id: 1,
      guildId: "guild-1",
      originalMessageId: "msg-1",
      originalChannelId: "channel-1",
      originalAuthorId: "author-1",
      authorDisplayName: "TestUser",
      messageContent: "test message",
      starboardMessageId: "deleted-sb-msg",
      starCount: 4,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    vi.mocked(accessor.upsertEntry).mockResolvedValue({ entry, isNew: false });

    const mockSend = vi.fn().mockResolvedValue({ id: "new-sb-msg" });
    const mockFetchMessages = vi.fn().mockRejectedValue(new Error("Unknown Message"));
    const mockStarboardChannel = {
      isTextBased: () => true,
      messages: { fetch: mockFetchMessages },
      send: mockSend,
    } as unknown as TextChannel;
    vi.mocked(message.guild!.channels.fetch).mockResolvedValue(mockStarboardChannel as never);

    await engine.handleReactionUpdate(reaction, STARBOARD_CHANNEL_ID);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(accessor.setStarboardMessageId).toHaveBeenCalledWith("guild-1", "msg-1", "new-sb-msg");
  });

  it("should fetch partial reactions before processing", async () => {
    const message = createMockMessage({});
    const fullReaction = createMockReaction(message, 3);

    const partialReaction = {
      partial: true,
      fetch: vi.fn().mockResolvedValue(fullReaction),
    } as unknown as MessageReaction;

    const entry: StarboardEntry = {
      id: 1,
      guildId: "guild-1",
      originalMessageId: "msg-1",
      originalChannelId: "channel-1",
      originalAuthorId: "author-1",
      authorDisplayName: "TestUser",
      messageContent: "test message",
      starboardMessageId: null,
      starCount: 3,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    vi.mocked(accessor.upsertEntry).mockResolvedValue({ entry, isNew: true });

    const mockSend = vi.fn().mockResolvedValue({ id: "sb-msg-1" });
    const mockStarboardChannel = { isTextBased: () => true, send: mockSend } as unknown as TextChannel;
    vi.mocked(message.guild!.channels.fetch).mockResolvedValue(mockStarboardChannel as never);

    await engine.handleReactionUpdate(partialReaction, STARBOARD_CHANNEL_ID);

    expect(partialReaction.fetch).toHaveBeenCalled();
    expect(accessor.upsertEntry).toHaveBeenCalled();
  });
});
