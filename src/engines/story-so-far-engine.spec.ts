import { describe, it, expect, vi, beforeEach } from "vitest";
import { StorySoFarEngine } from "./story-so-far-engine.js";
import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { ChannelAccessor } from "../accessors/channel-accessor.js";
import { Collection } from "discord.js";
import type { Message, Attachment, GuildTextBasedChannel } from "discord.js";

function createMockOllama(): OllamaAccessor {
  return { chat: vi.fn() } as unknown as OllamaAccessor;
}

function createMockChannelAccessor(): ChannelAccessor {
  return {
    fetchMessagesUntilUser: vi.fn(),
    fetchMessages: vi.fn(),
  } as unknown as ChannelAccessor;
}

function createMockChannel(): GuildTextBasedChannel {
  return { id: "chan1", guildId: "guild1" } as unknown as GuildTextBasedChannel;
}

function createMockMessage(overrides: {
  id: string;
  content: string;
  authorId: string;
  displayName: string;
  attachments?: { name: string; url: string }[];
}): Message<true> {
  const attachments = new Collection<string, Attachment>();
  for (const a of overrides.attachments ?? []) {
    attachments.set(a.name, { name: a.name, url: a.url } as Attachment);
  }

  return {
    id: overrides.id,
    content: overrides.content,
    author: { id: overrides.authorId, displayName: overrides.displayName },
    member: { displayName: overrides.displayName },
    attachments,
    embeds: [],
  } as unknown as Message<true>;
}

describe("StorySoFarEngine", () => {
  let ollama: OllamaAccessor;
  let channelAccessor: ChannelAccessor;
  let engine: StorySoFarEngine;
  let channel: GuildTextBasedChannel;

  beforeEach(() => {
    ollama = createMockOllama();
    channelAccessor = createMockChannelAccessor();
    engine = new StorySoFarEngine(ollama, channelAccessor);
    channel = createMockChannel();
  });

  it("should summarize messages between user's last message and now", async () => {
    const messages = [
      createMockMessage({ id: "1", content: "Hey all", authorId: "other1", displayName: "Alice" }),
      createMockMessage({ id: "2", content: "What's up", authorId: "other2", displayName: "Bob" }),
    ];
    vi.mocked(channelAccessor.fetchMessagesUntilUser).mockResolvedValue(messages);
    vi.mocked(ollama.chat).mockResolvedValue("Alice greeted everyone and Bob responded.");

    const result = await engine.summarize(channel, "user1");

    expect(result.summary).toBe("Alice greeted everyone and Bob responded.");
    expect(result.messageCount).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it("should fall back to recent messages when user has no prior messages", async () => {
    vi.mocked(channelAccessor.fetchMessagesUntilUser).mockResolvedValue([]);

    const fallbackMessages = new Collection<string, Message<true>>();
    const msg = createMockMessage({ id: "1", content: "Hello", authorId: "other", displayName: "Alice" });
    fallbackMessages.set("1", msg);
    vi.mocked(channelAccessor.fetchMessages).mockResolvedValue(fallbackMessages);
    vi.mocked(ollama.chat).mockResolvedValue("Alice said hello.");

    const result = await engine.summarize(channel, "user1");

    expect(channelAccessor.fetchMessages).toHaveBeenCalledWith(channel, 100);
    expect(result.summary).toBe("Alice said hello.");
    expect(result.messageCount).toBe(1);
  });

  it("should return friendly message when channel is empty", async () => {
    vi.mocked(channelAccessor.fetchMessagesUntilUser).mockResolvedValue([]);
    vi.mocked(channelAccessor.fetchMessages).mockResolvedValue(
      new Collection<string, Message<true>>(),
    );

    const result = await engine.summarize(channel, "user1");

    expect(result.summary).toContain("aren't any messages");
    expect(result.messageCount).toBe(0);
    expect(ollama.chat).not.toHaveBeenCalled();
  });

  it("should extract media references from attachments", async () => {
    const messages = [
      createMockMessage({
        id: "1",
        content: "Check this out",
        authorId: "other",
        displayName: "Alice",
        attachments: [{ name: "photo.png", url: "https://cdn.example.com/photo.png" }],
      }),
    ];
    vi.mocked(channelAccessor.fetchMessagesUntilUser).mockResolvedValue(messages);
    vi.mocked(ollama.chat).mockResolvedValue("Alice shared a photo.");

    const result = await engine.summarize(channel, "user1");

    expect(result.mediaReferences).toHaveLength(1);
    expect(result.mediaReferences[0].url).toBe("https://cdn.example.com/photo.png");
    expect(result.mediaReferences[0].messageUrl).toBe(
      "https://discord.com/channels/guild1/chan1/1",
    );
  });

  it("should extract URLs from message content", async () => {
    const messages = [
      createMockMessage({
        id: "1",
        content: "Look at https://example.com/cool-thing",
        authorId: "other",
        displayName: "Bob",
      }),
    ];
    vi.mocked(channelAccessor.fetchMessagesUntilUser).mockResolvedValue(messages);
    vi.mocked(ollama.chat).mockResolvedValue("Bob shared a link.");

    const result = await engine.summarize(channel, "user1");

    expect(result.mediaReferences).toHaveLength(1);
    expect(result.mediaReferences[0].url).toBe("https://example.com/cool-thing");
  });

  it("should return fallback message when Ollama fails", async () => {
    const messages = [
      createMockMessage({ id: "1", content: "Hello", authorId: "other", displayName: "Alice" }),
    ];
    vi.mocked(channelAccessor.fetchMessagesUntilUser).mockResolvedValue(messages);
    vi.mocked(ollama.chat).mockRejectedValue(new Error("timeout"));

    const result = await engine.summarize(channel, "user1");

    expect(result.summary).toContain("wasn't able to generate");
    expect(result.messageCount).toBe(1);
  });

  it("should truncate long transcripts and flag truncation", async () => {
    // Create enough messages to exceed the token limit (6000 tokens = 24000 chars)
    const messages: Message<true>[] = [];
    for (let i = 0; i < 300; i++) {
      messages.push(
        createMockMessage({
          id: String(i),
          content: "A".repeat(100),
          authorId: "other",
          displayName: "User",
        }),
      );
    }
    vi.mocked(channelAccessor.fetchMessagesUntilUser).mockResolvedValue(messages);
    vi.mocked(ollama.chat).mockResolvedValue("Summary of a long conversation.");

    const result = await engine.summarize(channel, "user1");

    expect(result.truncated).toBe(true);
    expect(result.messageCount).toBe(300);

    const transcript = vi.mocked(ollama.chat).mock.calls[0][0][1].content;
    expect(transcript).toContain("trimmed for length");
  });
});
