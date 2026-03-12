import { describe, it, expect, vi } from "vitest";
import { ChannelType } from "discord.js";
import { createMessageChatHandler } from "./message-chat.js";
import type { ChatEngine } from "../engines/chat-engine.js";

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
}));
vi.mock("../utilities/logger.js", () => mockLogger);

const BOT_ID = "bot-123";

function createMockChatEngine(response = "Hello there!"): ChatEngine {
  return { respond: vi.fn().mockResolvedValue(response) } as unknown as ChatEngine;
}

function createMockMessage(overrides: {
  content?: string;
  isBot?: boolean;
  referenceMessageId?: string | null;
  referencedAuthorId?: string | null;
  fetchReferenceFails?: boolean;
}) {
  const {
    content = "hello",
    isBot = false,
    referenceMessageId = null,
    referencedAuthorId = null,
    fetchReferenceFails = false,
  } = overrides;

  const contextMessages = new Map();
  contextMessages.set("ctx-1", {
    author: { displayName: "Alice", id: "alice-1" },
    content: "earlier message",
  });

  const fetchFn = vi.fn().mockImplementation((arg: unknown) => {
    if (typeof arg === "string") {
      if (fetchReferenceFails) return Promise.reject(new Error("not found"));
      return Promise.resolve({
        author: { id: referencedAuthorId ?? "someone-else" },
      });
    }
    return Promise.resolve(contextMessages);
  });

  return {
    id: "msg-1",
    content,
    author: { bot: isBot, displayName: "TestUser", id: "user-1" },
    guild: { id: "guild-1" },
    client: { user: { id: BOT_ID } },
    channel: {
      type: ChannelType.GuildText,
      messages: { fetch: fetchFn },
      sendTyping: vi.fn(),
    },
    reference: referenceMessageId ? { messageId: referenceMessageId } : null,
    reply: vi.fn(),
  };
}

describe("createMessageChatHandler", () => {
  it("should return a messageCreate handler", () => {
    const handler = createMessageChatHandler(createMockChatEngine(), 10);
    expect(handler.event).toBe("messageCreate");
    expect(handler.once).toBe(false);
  });

  it("should respond when the bot is @mentioned", async () => {
    const engine = createMockChatEngine("Hi!");
    const handler = createMessageChatHandler(engine, 5);
    const message = createMockMessage({ content: `Hey <@${BOT_ID}> what's up?` });

    await handler.execute(message as never);

    expect(engine.respond).toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalledWith("Hi!");
  });

  it("should respond when someone replies to a bot message", async () => {
    const engine = createMockChatEngine("I'm here!");
    const handler = createMessageChatHandler(engine, 5);
    const message = createMockMessage({
      content: "what do you think?",
      referenceMessageId: "ref-msg-1",
      referencedAuthorId: BOT_ID,
    });

    await handler.execute(message as never);

    expect(engine.respond).toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalledWith("I'm here!");
  });

  it("should ignore replies to other users", async () => {
    const engine = createMockChatEngine();
    const handler = createMessageChatHandler(engine, 5);
    const message = createMockMessage({
      content: "replying to someone else",
      referenceMessageId: "ref-msg-1",
      referencedAuthorId: "other-user-456",
    });

    await handler.execute(message as never);

    expect(engine.respond).not.toHaveBeenCalled();
  });

  it("should ignore messages with no mention and no reply", async () => {
    const engine = createMockChatEngine();
    const handler = createMessageChatHandler(engine, 5);
    const message = createMockMessage({ content: "just a regular message" });

    await handler.execute(message as never);

    expect(engine.respond).not.toHaveBeenCalled();
  });

  it("should ignore bot messages", async () => {
    const engine = createMockChatEngine();
    const handler = createMessageChatHandler(engine, 5);
    const message = createMockMessage({ isBot: true, content: `<@${BOT_ID}>` });

    await handler.execute(message as never);

    expect(engine.respond).not.toHaveBeenCalled();
  });

  it("should gracefully handle failed reference fetch", async () => {
    const engine = createMockChatEngine();
    const handler = createMessageChatHandler(engine, 5);
    const message = createMockMessage({
      content: "replying to deleted message",
      referenceMessageId: "deleted-msg",
      fetchReferenceFails: true,
    });

    await handler.execute(message as never);

    expect(engine.respond).not.toHaveBeenCalled();
  });

  it("should exclude non-reply bot messages from context", async () => {
    const engine = createMockChatEngine("Hi!");
    const handler = createMessageChatHandler(engine, 5);

    const contextMessages = new Map();
    // A standalone bot message (no reference) — e.g. startup announcement
    contextMessages.set("ctx-announce", {
      author: { displayName: "Trillian", id: BOT_ID },
      content: "I'm back online! 🟢",
      reference: null,
    });
    // A bot reply (has reference) — should be included
    contextMessages.set("ctx-reply", {
      author: { displayName: "Trillian", id: BOT_ID },
      content: "Hey there!",
      reference: { messageId: "some-msg" },
    });
    // A user message — should be included
    contextMessages.set("ctx-user", {
      author: { displayName: "Alice", id: "alice-1" },
      content: "hi bot",
      reference: null,
    });

    const message = createMockMessage({ content: `<@${BOT_ID}> hello` });
    message.channel.messages.fetch = vi.fn().mockImplementation((arg: unknown) => {
      if (typeof arg === "string") {
        return Promise.resolve({ author: { id: "someone-else" } });
      }
      return Promise.resolve(contextMessages);
    });

    await handler.execute(message as never);

    const recentMessages = (engine.respond as ReturnType<typeof vi.fn>).mock.calls[0][2];
    // Should have 2 context messages: bot reply + user message (not the announcement)
    expect(recentMessages).toHaveLength(2);
    expect(recentMessages[0].content).toBe("hi bot");
    expect(recentMessages[1].content).toBe("Hey there!");
  });

  it("should send typing indicator before responding", async () => {
    const engine = createMockChatEngine("response");
    const handler = createMessageChatHandler(engine, 5);
    const message = createMockMessage({ content: `<@${BOT_ID}>` });

    await handler.execute(message as never);

    expect(message.channel.sendTyping).toHaveBeenCalled();
  });
});
