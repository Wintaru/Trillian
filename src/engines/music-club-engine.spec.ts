import { describe, it, expect, vi, beforeEach } from "vitest";
import { MusicClubEngine } from "./music-club-engine.js";
import type { MusicClubAccessor } from "../accessors/music-club-accessor.js";
import type { OdesliAccessor } from "../accessors/odesli-accessor.js";

function createMockAccessor(): MusicClubAccessor {
  return {
    addMember: vi.fn(),
    removeMember: vi.fn(),
    isMember: vi.fn(),
    getMemberCount: vi.fn(),
    createRound: vi.fn(),
    getRound: vi.fn(),
    getActiveRound: vi.fn(),
    getLatestRound: vi.fn(),
    setRoundMessageId: vi.fn(),
    setRoundStatus: vi.fn(),
    setPlaylistMessageId: vi.fn(),
    setResultsMessageId: vi.fn(),
    getOpenRoundsWithAllSubmissions: vi.fn(),
    getRoundsReadyToTransition: vi.fn(),
    getRoundsReadyToClose: vi.fn(),
    getRoundsNeedingSubmissionReminder: vi.fn(),
    getRoundsNeedingRatingReminder: vi.fn(),
    markSubmissionReminderSent: vi.fn(),
    markRatingReminderSent: vi.fn(),
    upsertSong: vi.fn(),
    getSong: vi.fn(),
    getSongsForRound: vi.fn(),
    upsertRating: vi.fn(),
    getAverageRatings: vi.fn(),
    getRaterTallies: vi.fn(),
  } as unknown as MusicClubAccessor;
}

function createMockOdesli(): OdesliAccessor {
  return {
    getLinks: vi.fn(),
  } as unknown as OdesliAccessor;
}

const ROUND_ROW = {
  id: 1,
  guildId: "g1",
  channelId: "c1",
  messageId: "m1",
  status: "open",
  startsAt: 1000,
  submissionsCloseAt: 2000,
  ratingsCloseAt: 3000,
  playlistMessageId: "",
  resultsMessageId: "",
  createdAt: 1000,
};

describe("MusicClubEngine", () => {
  let accessor: MusicClubAccessor;
  let odesli: OdesliAccessor;
  let engine: MusicClubEngine;

  beforeEach(() => {
    accessor = createMockAccessor();
    odesli = createMockOdesli();
    engine = new MusicClubEngine(accessor, odesli);
  });

  describe("join", () => {
    it("should join a new member", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(false);
      const result = await engine.join({ userId: "u1", guildId: "g1" });
      expect(result).toEqual({ success: true, reason: "joined" });
      expect(accessor.addMember).toHaveBeenCalledOnce();
    });

    it("should return already_member if already joined", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(true);
      const result = await engine.join({ userId: "u1", guildId: "g1" });
      expect(result).toEqual({ success: true, reason: "already_member" });
      expect(accessor.addMember).not.toHaveBeenCalled();
    });
  });

  describe("leave", () => {
    it("should remove a member", async () => {
      vi.mocked(accessor.removeMember).mockResolvedValue(true);
      const result = await engine.leave({ userId: "u1", guildId: "g1" });
      expect(result).toEqual({ success: true, reason: "left" });
    });

    it("should return not_member if not a member", async () => {
      vi.mocked(accessor.removeMember).mockResolvedValue(false);
      const result = await engine.leave({ userId: "u1", guildId: "g1" });
      expect(result).toEqual({ success: false, reason: "not_member" });
    });
  });

  describe("submitSong", () => {
    it("should reject non-members", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(false);
      const result = await engine.submitSong({
        roundId: 1, userId: "u1", guildId: "g1", url: "https://open.spotify.com/track/123",
      });
      expect(result.reason).toBe("not_member");
    });

    it("should reject invalid URLs", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(true);
      const result = await engine.submitSong({
        roundId: 1, userId: "u1", guildId: "g1", url: "not-a-url",
      });
      expect(result.reason).toBe("invalid_url");
    });

    it("should reject when round not found", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(true);
      vi.mocked(accessor.getRound).mockResolvedValue(null);
      const result = await engine.submitSong({
        roundId: 999, userId: "u1", guildId: "g1", url: "https://open.spotify.com/track/123",
      });
      expect(result.reason).toBe("round_not_found");
    });

    it("should reject when round is not open", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(true);
      vi.mocked(accessor.getRound).mockResolvedValue({ ...ROUND_ROW, status: "listening" });
      const result = await engine.submitSong({
        roundId: 1, userId: "u1", guildId: "g1", url: "https://open.spotify.com/track/123",
      });
      expect(result.reason).toBe("round_not_open");
    });

    it("should submit a song with Odesli data", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(true);
      vi.mocked(accessor.getRound).mockResolvedValue(ROUND_ROW);
      vi.mocked(odesli.getLinks).mockResolvedValue({
        title: "Test Song",
        artist: "Test Artist",
        links: { pageUrl: "https://song.link/123", spotify: "https://open.spotify.com/track/123" },
      });
      vi.mocked(accessor.upsertSong).mockResolvedValue("submitted");

      const result = await engine.submitSong({
        roundId: 1, userId: "u1", guildId: "g1",
        url: "https://open.spotify.com/track/123", reason: "Great song!",
      });

      expect(result.success).toBe(true);
      expect(result.reason).toBe("submitted");
      expect(result.song?.title).toBe("Test Song");
      expect(accessor.upsertSong).toHaveBeenCalledOnce();
    });

    it("should still submit when Odesli fails", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(true);
      vi.mocked(accessor.getRound).mockResolvedValue(ROUND_ROW);
      vi.mocked(odesli.getLinks).mockResolvedValue(null);
      vi.mocked(accessor.upsertSong).mockResolvedValue("submitted");

      const result = await engine.submitSong({
        roundId: 1, userId: "u1", guildId: "g1",
        url: "https://example.com/song",
      });

      expect(result.success).toBe(true);
      expect(result.song?.title).toBe("");
    });
  });

  describe("rateSong", () => {
    it("should reject non-members", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(false);
      const result = await engine.rateSong({ songId: 1, userId: "u1", guildId: "g1", rating: 8 });
      expect(result.reason).toBe("not_member");
    });

    it("should reject invalid ratings", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(true);
      const result = await engine.rateSong({ songId: 1, userId: "u1", guildId: "g1", rating: 11 });
      expect(result.reason).toBe("invalid_rating");
    });

    it("should reject rating 0", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(true);
      const result = await engine.rateSong({ songId: 1, userId: "u1", guildId: "g1", rating: 0 });
      expect(result.reason).toBe("invalid_rating");
    });

    it("should reject when song not found", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(true);
      vi.mocked(accessor.getSong).mockResolvedValue(null);
      const result = await engine.rateSong({ songId: 999, userId: "u1", guildId: "g1", rating: 8 });
      expect(result.reason).toBe("song_not_found");
    });

    it("should reject rating your own song", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(true);
      vi.mocked(accessor.getSong).mockResolvedValue({
        id: 1, roundId: 1, userId: "u1", originalUrl: "", title: "", artist: "",
        odesliData: "{}", reason: "", submittedAt: 1000,
      });
      const result = await engine.rateSong({ songId: 1, userId: "u1", guildId: "g1", rating: 8 });
      expect(result.reason).toBe("own_song");
    });

    it("should reject when round is not in listening status", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(true);
      vi.mocked(accessor.getSong).mockResolvedValue({
        id: 1, roundId: 1, userId: "u2", originalUrl: "", title: "", artist: "",
        odesliData: "{}", reason: "", submittedAt: 1000,
      });
      vi.mocked(accessor.getRound).mockResolvedValue({ ...ROUND_ROW, status: "open" });
      const result = await engine.rateSong({ songId: 1, userId: "u1", guildId: "g1", rating: 8 });
      expect(result.reason).toBe("round_not_listening");
    });

    it("should accept a valid rating", async () => {
      vi.mocked(accessor.isMember).mockResolvedValue(true);
      vi.mocked(accessor.getSong).mockResolvedValue({
        id: 1, roundId: 1, userId: "u2", originalUrl: "", title: "", artist: "",
        odesliData: "{}", reason: "", submittedAt: 1000,
      });
      vi.mocked(accessor.getRound).mockResolvedValue({ ...ROUND_ROW, status: "listening" });
      vi.mocked(accessor.upsertRating).mockResolvedValue("rated");

      const result = await engine.rateSong({ songId: 1, userId: "u1", guildId: "g1", rating: 8 });
      expect(result).toEqual({ success: true, reason: "rated" });
      expect(accessor.upsertRating).toHaveBeenCalledOnce();
    });
  });

  describe("startNewRound", () => {
    it("should create a round with correct close times", async () => {
      vi.mocked(accessor.createRound).mockResolvedValue({ id: 42 });

      const result = await engine.startNewRound({
        guildId: "g1", channelId: "c1", submissionDays: 2, ratingDays: 2,
      });

      expect(result.roundId).toBe(42);
      expect(result.submissionsCloseAt).toBeGreaterThan(Date.now());
      expect(result.ratingsCloseAt).toBeGreaterThan(result.submissionsCloseAt);
      expect(accessor.createRound).toHaveBeenCalledOnce();
    });
  });

  describe("getResults", () => {
    it("should return null when round not found", async () => {
      vi.mocked(accessor.getRound).mockResolvedValue(null);
      const result = await engine.getResults(999);
      expect(result).toBeNull();
    });

    it("should return songs sorted by average rating", async () => {
      vi.mocked(accessor.getRound).mockResolvedValue(ROUND_ROW);
      vi.mocked(accessor.getSongsForRound).mockResolvedValue([
        { id: 1, roundId: 1, userId: "u1", originalUrl: "", title: "Song A", artist: "A", odesliData: "{}", reason: "", submittedAt: 1000 },
        { id: 2, roundId: 1, userId: "u2", originalUrl: "", title: "Song B", artist: "B", odesliData: "{}", reason: "", submittedAt: 1001 },
      ]);
      vi.mocked(accessor.getAverageRatings).mockResolvedValue([
        { songId: 1, averageRating: 6.5, ratingCount: 2 },
        { songId: 2, averageRating: 8.0, ratingCount: 3 },
      ]);
      vi.mocked(accessor.getRaterTallies).mockResolvedValue([
        { userId: "u3", totalPointsGiven: 30, songsRated: 2 },
      ]);

      const result = await engine.getResults(1);
      expect(result?.songs).toHaveLength(2);
      expect(result?.songs[0].title).toBe("Song B");
      expect(result?.songs[0].averageRating).toBe(8);
      expect(result?.songs[1].title).toBe("Song A");
      expect(result?.songs[1].averageRating).toBe(6.5);
    });
  });

  describe("transitionToListening", () => {
    it("should transition ready rounds and return them", async () => {
      vi.mocked(accessor.getRoundsReadyToTransition).mockResolvedValue([
        { id: 1, channelId: "c1", messageId: "m1" },
      ]);

      const result = await engine.transitionToListening();
      expect(result).toHaveLength(1);
      expect(accessor.setRoundStatus).toHaveBeenCalledWith(1, "listening");
    });
  });

  describe("closeExpiredRounds", () => {
    it("should close ready rounds and return them", async () => {
      vi.mocked(accessor.getRoundsReadyToClose).mockResolvedValue([
        { id: 1, channelId: "c1", playlistMessageId: "p1" },
      ]);

      const result = await engine.closeExpiredRounds();
      expect(result).toHaveLength(1);
      expect(accessor.setRoundStatus).toHaveBeenCalledWith(1, "closed");
    });
  });
});
