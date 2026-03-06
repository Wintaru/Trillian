import { describe, it, expect, vi, beforeEach } from "vitest";
import { PollEngine } from "./poll-engine.js";
import type { PollAccessor, PollRow } from "../accessors/poll-accessor.js";

function createMockAccessor(): PollAccessor {
  return {
    createPoll: vi.fn(),
    setPollMessageId: vi.fn(),
    getPoll: vi.fn(),
    closePoll: vi.fn(),
    upsertVote: vi.fn(),
    getVoteCounts: vi.fn(),
    getOpenPollsDueBefore: vi.fn(),
  } as unknown as PollAccessor;
}

function createPollRow(overrides: Partial<PollRow> = {}): PollRow {
  return {
    id: 1,
    guildId: "guild1",
    channelId: "channel1",
    messageId: "msg1",
    creatorId: "creator1",
    question: "Favorite color?",
    options: JSON.stringify(["Red", "Blue", "Green"]),
    status: "open",
    closesAt: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("PollEngine", () => {
  let engine: PollEngine;
  let accessor: PollAccessor;

  beforeEach(() => {
    accessor = createMockAccessor();
    engine = new PollEngine(accessor);
  });

  describe("createPoll", () => {
    it("should create a poll and return the result", async () => {
      vi.mocked(accessor.createPoll).mockResolvedValue({ id: 42 });

      const result = await engine.createPoll({
        guildId: "guild1",
        channelId: "channel1",
        creatorId: "user1",
        question: "Favorite color?",
        options: ["Red", "Blue"],
        durationMinutes: null,
      });

      expect(result.pollId).toBe(42);
      expect(result.options).toEqual(["Red", "Blue"]);
      expect(result.closesAt).toBeGreaterThan(Date.now());
      expect(accessor.createPoll).toHaveBeenCalled();
    });

    it("should compute closesAt when duration is provided", async () => {
      vi.mocked(accessor.createPoll).mockResolvedValue({ id: 1 });

      const result = await engine.createPoll({
        guildId: "guild1",
        channelId: "channel1",
        creatorId: "user1",
        question: "Test?",
        options: ["A", "B"],
        durationMinutes: 60,
      });

      expect(result.closesAt).toBeGreaterThan(Date.now());
    });

    it("should reject fewer than 2 options", async () => {
      await expect(
        engine.createPoll({
          guildId: "guild1",
          channelId: "channel1",
          creatorId: "user1",
          question: "Test?",
          options: ["Only one"],
          durationMinutes: null,
        }),
      ).rejects.toThrow("between 2 and 10");
    });

    it("should reject more than 10 options", async () => {
      const options = Array.from({ length: 11 }, (_, i) => `Option ${i + 1}`);

      await expect(
        engine.createPoll({
          guildId: "guild1",
          channelId: "channel1",
          creatorId: "user1",
          question: "Test?",
          options,
          durationMinutes: null,
        }),
      ).rejects.toThrow("between 2 and 10");
    });

    it("should reject questions longer than 256 characters", async () => {
      await expect(
        engine.createPoll({
          guildId: "guild1",
          channelId: "channel1",
          creatorId: "user1",
          question: "x".repeat(257),
          options: ["A", "B"],
          durationMinutes: null,
        }),
      ).rejects.toThrow("256 characters");
    });
  });

  describe("castVote", () => {
    it("should record a new vote", async () => {
      vi.mocked(accessor.getPoll).mockResolvedValue(createPollRow());
      vi.mocked(accessor.upsertVote).mockResolvedValue(false);

      const result = await engine.castVote({ pollId: 1, userId: "user1", optionIndex: 0 });

      expect(result).toEqual({ success: true, reason: "voted" });
    });

    it("should indicate a changed vote", async () => {
      vi.mocked(accessor.getPoll).mockResolvedValue(createPollRow());
      vi.mocked(accessor.upsertVote).mockResolvedValue(true);

      const result = await engine.castVote({ pollId: 1, userId: "user1", optionIndex: 1 });

      expect(result).toEqual({ success: true, reason: "changed" });
    });

    it("should reject votes on closed polls", async () => {
      vi.mocked(accessor.getPoll).mockResolvedValue(createPollRow({ status: "closed" }));

      const result = await engine.castVote({ pollId: 1, userId: "user1", optionIndex: 0 });

      expect(result).toEqual({ success: false, reason: "poll_closed" });
    });

    it("should reject votes on nonexistent polls", async () => {
      vi.mocked(accessor.getPoll).mockResolvedValue(null);

      const result = await engine.castVote({ pollId: 999, userId: "user1", optionIndex: 0 });

      expect(result).toEqual({ success: false, reason: "poll_not_found" });
    });

    it("should reject invalid option index", async () => {
      vi.mocked(accessor.getPoll).mockResolvedValue(createPollRow());

      const result = await engine.castVote({ pollId: 1, userId: "user1", optionIndex: 5 });

      expect(result).toEqual({ success: false, reason: "invalid_option" });
    });
  });

  describe("closePoll", () => {
    it("should allow the creator to close their poll", async () => {
      vi.mocked(accessor.getPoll).mockResolvedValue(createPollRow());
      vi.mocked(accessor.getVoteCounts).mockResolvedValue([]);

      const result = await engine.closePoll({
        pollId: 1,
        requesterId: "creator1",
        isAdmin: false,
      });

      expect(result.success).toBe(true);
      expect(result.reason).toBe("closed");
      expect(accessor.closePoll).toHaveBeenCalledWith(1);
    });

    it("should allow an admin to close any poll", async () => {
      vi.mocked(accessor.getPoll).mockResolvedValue(createPollRow());
      vi.mocked(accessor.getVoteCounts).mockResolvedValue([]);

      const result = await engine.closePoll({
        pollId: 1,
        requesterId: "someadmin",
        isAdmin: true,
      });

      expect(result.success).toBe(true);
    });

    it("should reject non-creator non-admin", async () => {
      vi.mocked(accessor.getPoll).mockResolvedValue(createPollRow());

      const result = await engine.closePoll({
        pollId: 1,
        requesterId: "random_user",
        isAdmin: false,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe("not_authorized");
    });

    it("should reject closing an already closed poll", async () => {
      vi.mocked(accessor.getPoll).mockResolvedValue(createPollRow({ status: "closed" }));

      const result = await engine.closePoll({
        pollId: 1,
        requesterId: "creator1",
        isAdmin: false,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe("already_closed");
    });

    it("should return not_found for nonexistent polls", async () => {
      vi.mocked(accessor.getPoll).mockResolvedValue(null);

      const result = await engine.closePoll({
        pollId: 999,
        requesterId: "user1",
        isAdmin: false,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe("not_found");
    });
  });

  describe("getPollResults", () => {
    it("should assemble vote counts correctly", async () => {
      vi.mocked(accessor.getPoll).mockResolvedValue(createPollRow());
      vi.mocked(accessor.getVoteCounts).mockResolvedValue([
        { optionIndex: 0, count: 3 },
        { optionIndex: 2, count: 1 },
      ]);

      const results = await engine.getPollResults({ pollId: 1 });

      expect(results).not.toBeNull();
      expect(results!.voteCounts).toEqual([3, 0, 1]);
      expect(results!.totalVotes).toBe(4);
    });

    it("should return null for nonexistent polls", async () => {
      vi.mocked(accessor.getPoll).mockResolvedValue(null);

      const results = await engine.getPollResults({ pollId: 999 });

      expect(results).toBeNull();
    });

    it("should handle polls with no votes", async () => {
      vi.mocked(accessor.getPoll).mockResolvedValue(createPollRow());
      vi.mocked(accessor.getVoteCounts).mockResolvedValue([]);

      const results = await engine.getPollResults({ pollId: 1 });

      expect(results!.voteCounts).toEqual([0, 0, 0]);
      expect(results!.totalVotes).toBe(0);
    });
  });

  describe("closeExpiredPolls", () => {
    it("should close polls past their closesAt time", async () => {
      const expired = [{ id: 1, channelId: "ch1", messageId: "msg1" }];
      vi.mocked(accessor.getOpenPollsDueBefore).mockResolvedValue(expired);

      const result = await engine.closeExpiredPolls();

      expect(result).toEqual(expired);
      expect(accessor.closePoll).toHaveBeenCalledWith(1);
    });

    it("should return empty array when nothing is expired", async () => {
      vi.mocked(accessor.getOpenPollsDueBefore).mockResolvedValue([]);

      const result = await engine.closeExpiredPolls();

      expect(result).toEqual([]);
      expect(accessor.closePoll).not.toHaveBeenCalled();
    });
  });
});
