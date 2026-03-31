import { describe, it, expect, vi } from "vitest";
import { ChannelType } from "discord.js";
import { createMessageChatHandler } from "./message-chat.js";
import type { ChatEngine } from "../engines/chat-engine.js";
import type { ChatHandlerOptions } from "./message-chat.js";

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
}));
vi.mock("../utilities/logger.js", () => mockLogger);

const BOT_ID = "bot-123";

function createMockChatEngine(response = "Hello there!"): ChatEngine {
  return {
    respond: vi.fn().mockResolvedValue(response),
    interject: vi.fn().mockResolvedValue(response),
  } as unknown as ChatEngine;
}

function defaultOptions(engine: ChatEngine, overrides?: Partial<ChatHandlerOptions>): ChatHandlerOptions {
  return {
    chatEngine: engine,
    contextMessageCount: 5,
    interjectionChance: 0,
    interjectionCooldownMs: 300000,
    interjectionContextMessages: 30,
    ...overrides,
  };
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
      send: vi.fn(),
    },
    reference: referenceMessageId ? { messageId: referenceMessageId } : null,
    reply: vi.fn(),
  };
}

describe("createMessageChatHandler", () => {
  it("should return a messageCreate handler", () => {
    const handler = createMessageChatHandler(defaultOptions(createMockChatEngine()));
    expect(handler.event).toBe("messageCreate");
    expect(handler.once).toBe(false);
  });

  it("should respond when the bot is @mentioned", async () => {
    const engine = createMockChatEngine("Hi!");
    const handler = createMessageChatHandler(defaultOptions(engine));
    const message = createMockMessage({ content: `Hey <@${BOT_ID}> what's up?` });

    await handler.execute(message as never);

    expect(engine.respond).toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalledWith("Hi!");
  });

  it("should respond when someone replies to a bot message", async () => {
    const engine = createMockChatEngine("I'm here!");
    const handler = createMessageChatHandler(defaultOptions(engine));
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
    const handler = createMessageChatHandler(defaultOptions(engine));
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
    const handler = createMessageChatHandler(defaultOptions(engine));
    const message = createMockMessage({ content: "just a regular message" });

    await handler.execute(message as never);

    expect(engine.respond).not.toHaveBeenCalled();
  });

  it("should ignore bot messages", async () => {
    const engine = createMockChatEngine();
    const handler = createMessageChatHandler(defaultOptions(engine));
    const message = createMockMessage({ isBot: true, content: `<@${BOT_ID}>` });

    await handler.execute(message as never);

    expect(engine.respond).not.toHaveBeenCalled();
  });

  it("should gracefully handle failed reference fetch", async () => {
    const engine = createMockChatEngine();
    const handler = createMessageChatHandler(defaultOptions(engine));
    const message = createMockMessage({
      content: "replying to deleted message",
      referenceMessageId: "deleted-msg",
      fetchReferenceFails: true,
    });

    await handler.execute(message as never);

    expect(engine.respond).not.toHaveBeenCalled();
  });

  it("should only include messages from the target user and bot replies in context", async () => {
    const engine = createMockChatEngine("Hi!");
    const handler = createMessageChatHandler(defaultOptions(engine));

    const contextMessages = new Map();
    // A standalone bot message (no reference) — e.g. startup announcement — excluded
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
    // A message from another user — excluded
    contextMessages.set("ctx-other", {
      author: { displayName: "Bob", id: "bob-1" },
      content: "random chatter",
      reference: null,
    });
    // A message from the target user — should be included
    contextMessages.set("ctx-user", {
      author: { displayName: "TestUser", id: "user-1" },
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
    // Should have 2 context messages: bot reply + target user message (not announcement or other user)
    expect(recentMessages).toHaveLength(2);
    expect(recentMessages[0].content).toBe("hi bot");
    expect(recentMessages[1].content).toBe("Hey there!");
  });

  it("should send typing indicator before responding", async () => {
    const engine = createMockChatEngine("response");
    const handler = createMessageChatHandler(defaultOptions(engine));
    const message = createMockMessage({ content: `<@${BOT_ID}>` });

    await handler.execute(message as never);

    expect(message.channel.sendTyping).toHaveBeenCalled();
  });
});

describe("random interjection", () => {
  it("should not interject when chance is 0", async () => {
    const engine = createMockChatEngine("butting in!");
    const handler = createMessageChatHandler(defaultOptions(engine, { interjectionChance: 0 }));
    const message = createMockMessage({ content: "just chatting" });

    await handler.execute(message as never);

    expect(engine.interject).not.toHaveBeenCalled();
  });

  it("should interject when random roll succeeds", async () => {
    const engine = createMockChatEngine("butting in!");
    const handler = createMessageChatHandler(defaultOptions(engine, {
      interjectionChance: 1,
      interjectionCooldownMs: 0,
    }));
    const message = createMockMessage({ content: "just chatting" });

    await handler.execute(message as never);

    expect(engine.interject).toHaveBeenCalled();
    expect(message.channel.send).toHaveBeenCalledWith("butting in!");
    // Should NOT use reply for interjections
    expect(message.reply).not.toHaveBeenCalled();
  });

  it("should respect cooldown between interjections", async () => {
    const engine = createMockChatEngine("butting in!");
    const handler = createMessageChatHandler(defaultOptions(engine, {
      interjectionChance: 1,
      interjectionCooldownMs: 999999,
    }));

    const msg1 = createMockMessage({ content: "first message" });
    await handler.execute(msg1 as never);
    expect(engine.interject).toHaveBeenCalledTimes(1);

    const msg2 = createMockMessage({ content: "second message" });
    await handler.execute(msg2 as never);
    // Second call should be blocked by cooldown
    expect(engine.interject).toHaveBeenCalledTimes(1);
  });

  it("should not send message when interject returns null", async () => {
    const engine = createMockChatEngine("ignored");
    vi.mocked(engine.interject).mockResolvedValue(null);
    const handler = createMessageChatHandler(defaultOptions(engine, {
      interjectionChance: 1,
      interjectionCooldownMs: 0,
    }));
    const message = createMockMessage({ content: "just chatting" });

    await handler.execute(message as never);

    expect(engine.interject).toHaveBeenCalled();
    expect(message.channel.send).not.toHaveBeenCalled();
  });
});
