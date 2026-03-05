import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatEngine } from "./chat-engine.js";
import type { OllamaAccessor } from "../accessors/ollama-accessor.js";

function createMockAccessor(): OllamaAccessor {
  return {
    chat: vi.fn(),
  } as unknown as OllamaAccessor;
}

describe("ChatEngine", () => {
  let accessor: OllamaAccessor;
  let engine: ChatEngine;

  beforeEach(() => {
    accessor = createMockAccessor();
    engine = new ChatEngine(accessor);
  });

  describe("stripMentions", () => {
    it("should strip a single mention", () => {
      expect(ChatEngine.stripMentions("<@123456> hello")).toBe("hello");
    });

    it("should strip a nickname mention", () => {
      expect(ChatEngine.stripMentions("<@!123456> hello")).toBe("hello");
    });

    it("should strip multiple mentions", () => {
      expect(ChatEngine.stripMentions("<@111> hi <@222>")).toBe("hi");
    });

    it("should return empty string when only a mention", () => {
      expect(ChatEngine.stripMentions("<@123456>")).toBe("");
    });

    it("should return text unchanged when no mentions", () => {
      expect(ChatEngine.stripMentions("just text")).toBe("just text");
    });
  });

  describe("stripNamePrefix", () => {
    it("should strip 'Trillian: ' prefix", () => {
      expect(ChatEngine.stripNamePrefix("Trillian: Hello there!")).toBe("Hello there!");
    });

    it("should strip quoted 'Trillian': prefix", () => {
      expect(ChatEngine.stripNamePrefix('"Trillian": Hello!')).toBe("Hello!");
    });

    it("should be case insensitive", () => {
      expect(ChatEngine.stripNamePrefix("trillian: hey")).toBe("hey");
    });

    it("should not strip if name appears mid-text", () => {
      expect(ChatEngine.stripNamePrefix("I am Trillian: the bot")).toBe("I am Trillian: the bot");
    });

    it("should return text unchanged when no prefix", () => {
      expect(ChatEngine.stripNamePrefix("Just a response")).toBe("Just a response");
    });
  });

  describe("respond", () => {
    it("should pass cleaned message to accessor", async () => {
      vi.mocked(accessor.chat).mockResolvedValue("Hey there!");

      const result = await engine.respond("<@123> hello", "TestUser", []);

      expect(result).toBe("Hey there!");
      const messages = vi.mocked(accessor.chat).mock.calls[0][0];
      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.content).toBe("[TestUser]: hello");
    });

    it("should include username in the system prompt", async () => {
      vi.mocked(accessor.chat).mockResolvedValue("Hi!");

      await engine.respond("hey", "CoolUser", []);

      const messages = vi.mocked(accessor.chat).mock.calls[0][0];
      expect(messages[0].content).toContain('"CoolUser"');
    });

    it("should use greeting prompt when message is empty after stripping", async () => {
      vi.mocked(accessor.chat).mockResolvedValue("Hello!");

      await engine.respond("<@123>", "TestUser", []);

      const messages = vi.mocked(accessor.chat).mock.calls[0][0];
      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.content).toContain("[TestUser]");
      expect(lastMessage.content).toContain("TestUser just said hi");
    });

    it("should truncate responses longer than 2000 characters", async () => {
      const longResponse = "a".repeat(2500);
      vi.mocked(accessor.chat).mockResolvedValue(longResponse);

      const result = await engine.respond("tell me a story", "TestUser", []);

      expect(result).toHaveLength(2000);
    });

    it("should return fallback message on error", async () => {
      vi.mocked(accessor.chat).mockRejectedValue(new Error("timeout"));

      const result = await engine.respond("hello", "TestUser", []);

      expect(result).toContain("circuits");
    });

    it("should include recent messages as conversation context", async () => {
      vi.mocked(accessor.chat).mockResolvedValue("I remember!");

      await engine.respond("what did I say?", "TestUser", [
        { authorName: "TestUser", authorIsBot: false, content: "I love pizza" },
        { authorName: "Trillian", authorIsBot: true, content: "Pizza is great!" },
      ]);

      const messages = vi.mocked(accessor.chat).mock.calls[0][0];
      // system + 2 context + 1 current = 4
      expect(messages).toHaveLength(4);
      expect(messages[1].role).toBe("user");
      expect(messages[1].content).toBe("[TestUser]: I love pizza");
      expect(messages[2].role).toBe("assistant");
      expect(messages[2].content).toBe("Pizza is great!");
    });

    it("should strip name prefix from response", async () => {
      vi.mocked(accessor.chat).mockResolvedValue("Trillian: Hello friend!");

      const result = await engine.respond("hi", "TestUser", []);

      expect(result).toBe("Hello friend!");
    });

    it("should skip empty context messages after stripping mentions", async () => {
      vi.mocked(accessor.chat).mockResolvedValue("Hi!");

      await engine.respond("hello", "TestUser", [
        { authorName: "TestUser", authorIsBot: false, content: "<@123>" },
      ]);

      const messages = vi.mocked(accessor.chat).mock.calls[0][0];
      // system + 0 context (stripped to empty) + 1 current = 2
      expect(messages).toHaveLength(2);
    });
  });
});
