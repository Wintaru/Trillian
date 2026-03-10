import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChallengeButtonHandler } from "./challenge-button-handler.js";
import type { ChallengeEngine } from "./challenge-engine.js";
import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";

function createMockEngine(): ChallengeEngine {
  return {
    submitTranslation: vi.fn(),
    getResults: vi.fn(),
    getLeaderboard: vi.fn(),
    closeExpiredChallenges: vi.fn(),
  } as unknown as ChallengeEngine;
}

function createMockButtonInteraction(customId: string): ButtonInteraction {
  return {
    customId,
    user: { id: "user-123" },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
    showModal: vi.fn(),
  } as unknown as ButtonInteraction;
}

function createMockModalInteraction(
  customId: string,
  translationValue: string,
): ModalSubmitInteraction {
  return {
    customId,
    user: { id: "user-123" },
    deferReply: vi.fn(),
    editReply: vi.fn(),
    fields: {
      getTextInputValue: vi.fn().mockReturnValue(translationValue),
    },
  } as unknown as ModalSubmitInteraction;
}

describe("ChallengeButtonHandler", () => {
  let engine: ChallengeEngine;
  let handler: ChallengeButtonHandler;

  beforeEach(() => {
    engine = createMockEngine();
    handler = new ChallengeButtonHandler(engine);
  });

  describe("canHandle", () => {
    it("should handle challenge_ prefixed IDs", () => {
      expect(handler.canHandle("challenge_submit:1")).toBe(true);
      expect(handler.canHandle("challenge_results:1")).toBe(true);
      expect(handler.canHandle("challenge_modal_submit:1")).toBe(true);
    });

    it("should not handle non-challenge IDs", () => {
      expect(handler.canHandle("vocab_save:1")).toBe(false);
      expect(handler.canHandle("poll_vote:1")).toBe(false);
    });
  });

  describe("handleButton — submit", () => {
    it("should show a modal when submit button is clicked", async () => {
      const interaction = createMockButtonInteraction("challenge_submit:42");

      await handler.handleButton(interaction);

      expect(interaction.showModal).toHaveBeenCalledOnce();
    });
  });

  describe("handleButton — results", () => {
    it("should reply with results embed", async () => {
      vi.mocked(engine.getResults).mockResolvedValue({
        challengeId: 1,
        sentence: "Hola",
        referenceTranslation: "Hello",
        language: "ES",
        direction: "to_english",
        context: "",
        status: "closed",
        closesAt: 0,
        submissions: [],
      });

      const interaction = createMockButtonInteraction("challenge_results:1");
      await handler.handleButton(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
      expect(interaction.editReply).toHaveBeenCalledOnce();
    });

    it("should reply with not found when challenge does not exist", async () => {
      vi.mocked(engine.getResults).mockResolvedValue(null);

      const interaction = createMockButtonInteraction("challenge_results:999");
      await handler.handleButton(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith("Challenge not found.");
    });
  });

  describe("handleModal — submit", () => {
    it("should submit translation and reply with grade embed", async () => {
      vi.mocked(engine.submitTranslation).mockResolvedValue({
        success: true,
        reason: "submitted",
        grade: {
          accuracyScore: 9,
          grammarScore: 8,
          naturalnessScore: 7,
          compositeScore: 8,
          feedback: "Great job!",
        },
      });

      const interaction = createMockModalInteraction("challenge_modal_submit:1", "Hello");
      await handler.handleModal(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
      expect(engine.submitTranslation).toHaveBeenCalledWith({
        challengeId: 1,
        userId: "user-123",
        translation: "Hello",
      });
      expect(interaction.editReply).toHaveBeenCalledOnce();
      const replyArg = vi.mocked(interaction.editReply).mock.calls[0][0];
      expect(replyArg).toHaveProperty("embeds");
    });

    it("should show error when challenge is closed", async () => {
      vi.mocked(engine.submitTranslation).mockResolvedValue({
        success: false,
        reason: "challenge_closed",
      });

      const interaction = createMockModalInteraction("challenge_modal_submit:1", "Hello");
      await handler.handleModal(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith("This challenge has already closed.");
    });

    it("should show error when empty translation submitted", async () => {
      const interaction = createMockModalInteraction("challenge_modal_submit:1", "   ");
      await handler.handleModal(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith("Please provide a translation.");
      expect(engine.submitTranslation).not.toHaveBeenCalled();
    });

    it("should handle engine errors gracefully", async () => {
      vi.mocked(engine.submitTranslation).mockRejectedValue(new Error("DB error"));

      const interaction = createMockModalInteraction("challenge_modal_submit:1", "Hello");
      await handler.handleModal(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        "An error occurred while grading your translation. Please try again.",
      );
    });
  });
});
