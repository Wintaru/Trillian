import { describe, it, expect, vi, beforeEach } from "vitest";
import { PollButtonHandler } from "./poll-button-handler.js";
import type { PollEngine } from "./poll-engine.js";
import type { ButtonInteraction } from "discord.js";

function createMockEngine(): PollEngine {
  return {
    castVote: vi.fn(),
    closePoll: vi.fn(),
    getPollResults: vi.fn(),
    createPoll: vi.fn(),
    setPollMessageId: vi.fn(),
    closeExpiredPolls: vi.fn(),
  } as unknown as PollEngine;
}

function createMockButtonInteraction(customId: string): ButtonInteraction {
  return {
    customId,
    user: { id: "user1" },
    memberPermissions: { has: vi.fn().mockReturnValue(false) },
    reply: vi.fn(),
    message: { edit: vi.fn() },
  } as unknown as ButtonInteraction;
}

describe("PollButtonHandler", () => {
  let handler: PollButtonHandler;
  let engine: PollEngine;

  beforeEach(() => {
    engine = createMockEngine();
    handler = new PollButtonHandler(engine);
  });

  describe("vote buttons", () => {
    it("should cast a vote and reply ephemerally", async () => {
      vi.mocked(engine.castVote).mockResolvedValue({ success: true, reason: "voted" });
      vi.mocked(engine.getPollResults).mockResolvedValue({
        pollId: 1,
        question: "Test?",
        options: ["A", "B"],
        voteCounts: [1, 0],
        totalVotes: 1,
        status: "open",
        closesAt: null,
      });

      const interaction = createMockButtonInteraction("poll_vote:1:0");
      await handler.handleButton(interaction);

      expect(engine.castVote).toHaveBeenCalledWith({
        pollId: 1,
        userId: "user1",
        optionIndex: 0,
      });
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "Your vote has been recorded!",
        flags: 64,
      });
      expect(interaction.message.edit).toHaveBeenCalled();
    });

    it("should indicate a changed vote", async () => {
      vi.mocked(engine.castVote).mockResolvedValue({ success: true, reason: "changed" });
      vi.mocked(engine.getPollResults).mockResolvedValue({
        pollId: 1,
        question: "Test?",
        options: ["A", "B"],
        voteCounts: [0, 1],
        totalVotes: 1,
        status: "open",
        closesAt: null,
      });

      const interaction = createMockButtonInteraction("poll_vote:1:1");
      await handler.handleButton(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: "Your vote has been changed!",
        flags: 64,
      });
    });

    it("should handle vote failure", async () => {
      vi.mocked(engine.castVote).mockResolvedValue({ success: false, reason: "poll_closed" });

      const interaction = createMockButtonInteraction("poll_vote:1:0");
      await handler.handleButton(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: "Could not record vote: poll closed.",
        flags: 64,
      });
      expect(interaction.message.edit).not.toHaveBeenCalled();
    });
  });

  describe("close buttons", () => {
    it("should close the poll when creator clicks", async () => {
      const results = {
        pollId: 1,
        question: "Test?",
        options: ["A", "B"],
        voteCounts: [2, 3],
        totalVotes: 5,
        status: "closed" as const,
        closesAt: null,
      };
      vi.mocked(engine.closePoll).mockResolvedValue({
        success: true,
        reason: "closed",
        results,
      });

      const interaction = createMockButtonInteraction("poll_close:1");
      await handler.handleButton(interaction);

      expect(engine.closePoll).toHaveBeenCalledWith({
        pollId: 1,
        requesterId: "user1",
        isAdmin: false,
      });
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "Poll closed!",
        flags: 64,
      });
      expect(interaction.message.edit).toHaveBeenCalledWith(
        expect.objectContaining({ components: [] }),
      );
    });

    it("should reject unauthorized close", async () => {
      vi.mocked(engine.closePoll).mockResolvedValue({
        success: false,
        reason: "not_authorized",
        results: null,
      });

      const interaction = createMockButtonInteraction("poll_close:1");
      await handler.handleButton(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: "Cannot close poll: not authorized.",
        flags: 64,
      });
    });
  });

  describe("unrelated buttons", () => {
    it("should ignore buttons with unrecognized custom IDs", async () => {
      const interaction = createMockButtonInteraction("some_other_button");
      await handler.handleButton(interaction);

      expect(interaction.reply).not.toHaveBeenCalled();
    });
  });
});
