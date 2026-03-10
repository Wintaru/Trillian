import { describe, it, expect, vi, beforeEach } from "vitest";
import { LessonEngine, buildLessonSystemPrompt } from "./lesson-engine.js";
import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { LessonAccessor } from "../accessors/lesson-accessor.js";

function createMockOllama(): OllamaAccessor {
  return { chat: vi.fn() } as unknown as OllamaAccessor;
}

function createMockLessonAccessor(): LessonAccessor {
  return {
    getActiveSession: vi.fn(),
    createSession: vi.fn(),
    endSession: vi.fn(),
    insertMessage: vi.fn(),
    getRecentMessages: vi.fn(),
    getMessageCount: vi.fn(),
  } as unknown as LessonAccessor;
}

describe("LessonEngine", () => {
  let ollama: OllamaAccessor;
  let accessor: LessonAccessor;
  let engine: LessonEngine;

  beforeEach(() => {
    ollama = createMockOllama();
    accessor = createMockLessonAccessor();
    engine = new LessonEngine(ollama, accessor);
  });

  describe("startLesson", () => {
    it("should create session and return greeting", async () => {
      vi.mocked(accessor.getActiveSession).mockResolvedValue(null);
      vi.mocked(accessor.createSession).mockResolvedValue({ id: 42 });
      vi.mocked(ollama.chat).mockResolvedValue("¡Hola! Bienvenido a tu lección de español.");

      const result = await engine.startLesson({ userId: "123", language: "ES" });

      expect(result.sessionId).toBe(42);
      expect(result.greeting).toBe("¡Hola! Bienvenido a tu lección de español.");
      expect(vi.mocked(accessor.createSession)).toHaveBeenCalledWith("123", "ES", expect.any(Number));
      expect(vi.mocked(accessor.insertMessage)).toHaveBeenCalledTimes(2);
      // First call: system prompt, second call: assistant greeting
      expect(vi.mocked(accessor.insertMessage).mock.calls[0][1]).toBe("system");
      expect(vi.mocked(accessor.insertMessage).mock.calls[1][1]).toBe("assistant");
    });

    it("should throw when active session already exists", async () => {
      vi.mocked(accessor.getActiveSession).mockResolvedValue({
        id: 1,
        userId: "123",
        language: "ES",
        status: "active",
        startedAt: Date.now(),
        endedAt: null,
      });

      await expect(engine.startLesson({ userId: "123", language: "FR" })).rejects.toThrow(
        "already have an active",
      );
    });
  });

  describe("stopLesson", () => {
    it("should end active session", async () => {
      vi.mocked(accessor.getActiveSession).mockResolvedValue({
        id: 1,
        userId: "123",
        language: "ES",
        status: "active",
        startedAt: Date.now(),
        endedAt: null,
      });

      const result = await engine.stopLesson({ userId: "123" });

      expect(result.ended).toBe(true);
      expect(result.reason).toBe("ended");
      expect(vi.mocked(accessor.endSession)).toHaveBeenCalledWith(1, expect.any(Number));
    });

    it("should return no_active_session when none exists", async () => {
      vi.mocked(accessor.getActiveSession).mockResolvedValue(null);

      const result = await engine.stopLesson({ userId: "123" });

      expect(result.ended).toBe(false);
      expect(result.reason).toBe("no_active_session");
    });
  });

  describe("getStatus", () => {
    it("should return active session info", async () => {
      vi.mocked(accessor.getActiveSession).mockResolvedValue({
        id: 5,
        userId: "123",
        language: "FR",
        status: "active",
        startedAt: 1000,
        endedAt: null,
      });

      const result = await engine.getStatus({ userId: "123" });

      expect(result.active).toBe(true);
      expect(result.sessionId).toBe(5);
      expect(result.language).toBe("FR");
      expect(result.startedAt).toBe(1000);
    });

    it("should return inactive state when no session", async () => {
      vi.mocked(accessor.getActiveSession).mockResolvedValue(null);

      const result = await engine.getStatus({ userId: "123" });

      expect(result.active).toBe(false);
      expect(result.sessionId).toBeNull();
      expect(result.language).toBeNull();
    });
  });

  describe("processMessage", () => {
    it("should store user message, call Ollama with context, and store reply", async () => {
      vi.mocked(accessor.getActiveSession).mockResolvedValue({
        id: 1,
        userId: "123",
        language: "ES",
        status: "active",
        startedAt: Date.now(),
        endedAt: null,
      });
      vi.mocked(accessor.getRecentMessages).mockResolvedValue([
        { role: "system", content: "You are a tutor..." },
        { role: "assistant", content: "¡Hola!" },
        { role: "user", content: "Hola, cómo estás?" },
      ]);
      vi.mocked(ollama.chat).mockResolvedValue("¡Muy bien! ¿Y tú?");

      const result = await engine.processMessage({ userId: "123", content: "Hola, cómo estás?" });

      expect(result.reply).toBe("¡Muy bien! ¿Y tú?");
      // Should insert user message then assistant reply
      expect(vi.mocked(accessor.insertMessage)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(accessor.insertMessage).mock.calls[0][1]).toBe("user");
      expect(vi.mocked(accessor.insertMessage).mock.calls[1][1]).toBe("assistant");
      // Ollama should receive the context messages
      expect(vi.mocked(ollama.chat)).toHaveBeenCalledWith([
        { role: "system", content: "You are a tutor..." },
        { role: "assistant", content: "¡Hola!" },
        { role: "user", content: "Hola, cómo estás?" },
      ]);
    });

    it("should throw when no active session", async () => {
      vi.mocked(accessor.getActiveSession).mockResolvedValue(null);

      await expect(engine.processMessage({ userId: "123", content: "hello" })).rejects.toThrow(
        "No active lesson session",
      );
    });
  });
});

describe("buildLessonSystemPrompt", () => {
  it("should include language name in prompt", () => {
    const prompt = buildLessonSystemPrompt("ES");
    expect(prompt).toContain("Spanish");
    expect(prompt).toContain("tutor");
  });

  it("should handle different languages", () => {
    const prompt = buildLessonSystemPrompt("FR");
    expect(prompt).toContain("French");
  });
});
