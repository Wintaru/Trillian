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

    it("should strip bracketed username prefix", () => {
      expect(ChatEngine.stripNamePrefix("[z28runner 🍕]: Seriously?!")).toBe("Seriously?!");
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
      expect(lastMessage.content).toBe("hello");
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

    it("should include recent messages as context in the system prompt", async () => {
      vi.mocked(accessor.chat).mockResolvedValue("I remember!");

      await engine.respond("what did I say?", "TestUser", [
        { authorName: "TestUser", authorIsBot: false, content: "I love pizza" },
        { authorName: "Trillian", authorIsBot: true, content: "Pizza is great!" },
      ]);

      const messages = vi.mocked(accessor.chat).mock.calls[0][0];
      // system + 1 current = 2 (context is in the system prompt now)
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toContain("TestUser: I love pizza");
      expect(messages[0].content).toContain("Trillian (you): Pizza is great!");
      expect(messages[0].content).toContain("background only");
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
      // system + 1 current = 2 (empty context not included in system prompt)
      expect(messages).toHaveLength(2);
      expect(messages[0].content).not.toContain("Recent chat history");
    });
  });

  describe("interject", () => {
    it("should send conversation messages as turns for theme analysis", async () => {
      vi.mocked(accessor.chat).mockResolvedValue("Nice topic!");

      const result = await engine.interject([
        { authorName: "Alice", authorIsBot: false, content: "I love hiking" },
        { authorName: "Bob", authorIsBot: false, content: "Me too, went last weekend" },
      ]);

      expect(result).toBe("Nice topic!");
      const messages = vi.mocked(accessor.chat).mock.calls[0][0];
      expect(messages[0].role).toBe("system");
      expect(messages[1].content).toBe("[Alice]: I love hiking");
      expect(messages[2].content).toBe("[Bob]: Me too, went last weekend");
    });

    it("should return null when not enough conversation to interject into", async () => {
      const result = await engine.interject([
        { authorName: "Alice", authorIsBot: false, content: "hey" },
      ]);

      expect(result).toBeNull();
      expect(accessor.chat).not.toHaveBeenCalled();
    });

    it("should return null on error", async () => {
      vi.mocked(accessor.chat).mockRejectedValue(new Error("timeout"));

      const result = await engine.interject([
        { authorName: "Alice", authorIsBot: false, content: "hello" },
        { authorName: "Bob", authorIsBot: false, content: "hi there" },
      ]);

      expect(result).toBeNull();
    });

    it("should strip name prefix from interjection response", async () => {
      vi.mocked(accessor.chat).mockResolvedValue("Trillian: That's cool!");

      const result = await engine.interject([
        { authorName: "Alice", authorIsBot: false, content: "hello" },
        { authorName: "Bob", authorIsBot: false, content: "hi there" },
      ]);

      expect(result).toBe("That's cool!");
    });
  });
});
