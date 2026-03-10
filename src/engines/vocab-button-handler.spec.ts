import { describe, it, expect, vi, beforeEach } from "vitest";
import { VocabButtonHandler } from "./vocab-button-handler.js";
import type { VocabEngine } from "./vocab-engine.js";
import type { ButtonInteraction } from "discord.js";

function createMockVocabEngine(): VocabEngine {
  return {
    saveWord: vi.fn(),
    answerQuiz: vi.fn(),
  } as unknown as VocabEngine;
}

function createMockInteraction(customId: string): ButtonInteraction {
  return {
    customId,
    user: { id: "user-123" },
    reply: vi.fn(),
  } as unknown as ButtonInteraction;
}

describe("VocabButtonHandler", () => {
  let engine: VocabEngine;
  let handler: VocabButtonHandler;

  beforeEach(() => {
    engine = createMockVocabEngine();
    handler = new VocabButtonHandler(engine);
  });

  describe("canHandle", () => {
    it("should handle vocab_ prefixed IDs", () => {
      expect(handler.canHandle("vocab_save:1")).toBe(true);
      expect(handler.canHandle("vocab_quiz_answer:1:2:3")).toBe(true);
    });

    it("should not handle non-vocab IDs", () => {
      expect(handler.canHandle("poll_vote:1")).toBe(false);
      expect(handler.canHandle("embed_refresh")).toBe(false);
    });
  });

  describe("handleButton — save", () => {
    it("should save word and reply with success", async () => {
      vi.mocked(engine.saveWord).mockResolvedValue({ saved: true, reason: "saved" });
      const interaction = createMockInteraction("vocab_save:42");

      await handler.handleButton(interaction);

      expect(vi.mocked(engine.saveWord)).toHaveBeenCalledWith({
        userId: "user-123",
        dailyWordId: 42,
      });
      expect(vi.mocked(interaction.reply)).toHaveBeenCalledWith({
        content: "Saved to your vocabulary!",
        flags: 64,
      });
    });

    it("should reply with already-saved message", async () => {
      vi.mocked(engine.saveWord).mockResolvedValue({ saved: true, reason: "already_saved" });
      const interaction = createMockInteraction("vocab_save:42");

      await handler.handleButton(interaction);

      expect(vi.mocked(interaction.reply)).toHaveBeenCalledWith({
        content: "You already saved this word.",
        flags: 64,
      });
    });

    it("should reply with error on failure", async () => {
      vi.mocked(engine.saveWord).mockRejectedValue(new Error("DB error"));
      const interaction = createMockInteraction("vocab_save:42");

      await handler.handleButton(interaction);

      expect(vi.mocked(interaction.reply)).toHaveBeenCalledWith({
        content: "Failed to save word.",
        flags: 64,
      });
    });
  });

  describe("handleButton — quiz answer", () => {
    it("should reply with correct answer result", async () => {
      vi.mocked(engine.answerQuiz).mockResolvedValue({
        correct: true,
        correctAnswer: "hello",
        reviewCount: 5,
        correctCount: 4,
      });
      const interaction = createMockInteraction("vocab_quiz_answer:1:2:2");

      await handler.handleButton(interaction);

      expect(vi.mocked(engine.answerQuiz)).toHaveBeenCalledWith({
        userId: "user-123",
        dailyWordId: 1,
        selectedIndex: 2,
        correctIndex: 2,
      });
      const replyCall = vi.mocked(interaction.reply).mock.calls[0][0] as { content: string };
      expect(replyCall.content).toContain("Correct!");
      expect(replyCall.content).toContain("4/5");
    });

    it("should reply with incorrect answer result", async () => {
      vi.mocked(engine.answerQuiz).mockResolvedValue({
        correct: false,
        correctAnswer: "hello",
        reviewCount: 3,
        correctCount: 1,
      });
      const interaction = createMockInteraction("vocab_quiz_answer:1:0:2");

      await handler.handleButton(interaction);

      const replyCall = vi.mocked(interaction.reply).mock.calls[0][0] as { content: string };
      expect(replyCall.content).toContain("Incorrect.");
      expect(replyCall.content).toContain("**hello**");
      expect(replyCall.content).toContain("1/3");
    });

    it("should reply with error on failure", async () => {
      vi.mocked(engine.answerQuiz).mockRejectedValue(new Error("DB error"));
      const interaction = createMockInteraction("vocab_quiz_answer:1:0:2");

      await handler.handleButton(interaction);

      expect(vi.mocked(interaction.reply)).toHaveBeenCalledWith({
        content: "Failed to record answer.",
        flags: 64,
      });
    });
  });
});
