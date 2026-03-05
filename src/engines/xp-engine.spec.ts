import { describe, it, expect, vi, beforeEach } from "vitest";
import { XpEngine } from "./xp-engine.js";
import type { XpAccessor } from "../accessors/xp-accessor.js";

function createMockAccessor(): XpAccessor {
  return {
    getUserXp: vi.fn(),
    upsertXp: vi.fn(),
    setUserXp: vi.fn(),
    resetUserXp: vi.fn(),
    getLeaderboard: vi.fn(),
    countGuildUsers: vi.fn(),
    getRankName: vi.fn(),
    getRoleRewardsAtLevel: vi.fn(),
    seedRanks: vi.fn(),
  } as unknown as XpAccessor;
}

describe("XpEngine", () => {
  describe("static xpForLevel", () => {
    it("should return 0 for level 0", () => {
      expect(XpEngine.xpForLevel(0)).toBe(0);
    });

    it("should return 155 for level 1", () => {
      expect(XpEngine.xpForLevel(1)).toBe(155);
    });

    it("should return 375 for level 2 (cumulative)", () => {
      expect(XpEngine.xpForLevel(2)).toBe(375);
    });

    it("should return 5675 for level 10", () => {
      expect(XpEngine.xpForLevel(10)).toBe(5675);
    });

    it("should return 0 for negative levels", () => {
      expect(XpEngine.xpForLevel(-1)).toBe(0);
    });
  });

  describe("static levelFromXp", () => {
    it("should return 0 for 0 XP", () => {
      expect(XpEngine.levelFromXp(0)).toBe(0);
    });

    it("should return 0 for 154 XP (just below level 1)", () => {
      expect(XpEngine.levelFromXp(154)).toBe(0);
    });

    it("should return 1 for exactly 155 XP", () => {
      expect(XpEngine.levelFromXp(155)).toBe(1);
    });

    it("should return 1 for 374 XP (just below level 2)", () => {
      expect(XpEngine.levelFromXp(374)).toBe(1);
    });

    it("should return 2 for exactly 375 XP", () => {
      expect(XpEngine.levelFromXp(375)).toBe(2);
    });

    it("should return 10 for exactly 5675 XP", () => {
      expect(XpEngine.levelFromXp(5675)).toBe(10);
    });
  });

  describe("awardXp", () => {
    let accessor: XpAccessor;
    let engine: XpEngine;

    beforeEach(() => {
      accessor = createMockAccessor();
      engine = new XpEngine(accessor, 20, 20, 60); // fixed XP for deterministic tests
    });

    it("should award XP to a new user", async () => {
      vi.mocked(accessor.getUserXp).mockResolvedValue(null);
      vi.mocked(accessor.upsertXp).mockResolvedValue({ xp: 20, level: 0 });
      vi.mocked(accessor.getRankName).mockResolvedValue(null);
      vi.mocked(accessor.getRoleRewardsAtLevel).mockResolvedValue([]);

      const result = await engine.awardXp({
        userId: "user1",
        guildId: "guild1",
        channelId: "ch1",
      });

      expect(result.awarded).toBe(true);
      expect(result.xpGained).toBe(20);
      expect(result.previousLevel).toBe(0);
      expect(result.currentLevel).toBe(0);
      expect(result.leveledUp).toBe(false);
      expect(accessor.upsertXp).toHaveBeenCalledOnce();
    });

    it("should reject XP when cooldown is active", async () => {
      const recentTimestamp = Date.now() - 10_000; // 10 seconds ago
      vi.mocked(accessor.getUserXp).mockResolvedValue({
        xp: 100,
        level: 0,
        lastXpAt: recentTimestamp,
      });

      const result = await engine.awardXp({
        userId: "user1",
        guildId: "guild1",
        channelId: "ch1",
      });

      expect(result.awarded).toBe(false);
      expect(result.xpGained).toBe(0);
      expect(accessor.upsertXp).not.toHaveBeenCalled();
    });

    it("should award XP when cooldown has elapsed", async () => {
      const oldTimestamp = Date.now() - 120_000; // 2 minutes ago
      vi.mocked(accessor.getUserXp).mockResolvedValue({
        xp: 100,
        level: 0,
        lastXpAt: oldTimestamp,
      });
      vi.mocked(accessor.upsertXp).mockResolvedValue({ xp: 120, level: 0 });
      vi.mocked(accessor.getRoleRewardsAtLevel).mockResolvedValue([]);

      const result = await engine.awardXp({
        userId: "user1",
        guildId: "guild1",
        channelId: "ch1",
      });

      expect(result.awarded).toBe(true);
      expect(result.xpGained).toBe(20);
    });

    it("should detect level-up and fetch rank name", async () => {
      vi.mocked(accessor.getUserXp).mockResolvedValue({
        xp: 140,
        level: 0,
        lastXpAt: null,
      });
      vi.mocked(accessor.upsertXp).mockResolvedValue({ xp: 160, level: 1 });
      vi.mocked(accessor.getRankName).mockResolvedValue("Mostly Harmless");
      vi.mocked(accessor.getRoleRewardsAtLevel).mockResolvedValue([]);

      const result = await engine.awardXp({
        userId: "user1",
        guildId: "guild1",
        channelId: "ch1",
      });

      expect(result.leveledUp).toBe(true);
      expect(result.previousLevel).toBe(0);
      expect(result.currentLevel).toBe(1);
      expect(result.rankName).toBe("Mostly Harmless");
    });

    it("should return role rewards on level-up", async () => {
      vi.mocked(accessor.getUserXp).mockResolvedValue({
        xp: 140,
        level: 0,
        lastXpAt: null,
      });
      vi.mocked(accessor.upsertXp).mockResolvedValue({ xp: 160, level: 1 });
      vi.mocked(accessor.getRankName).mockResolvedValue("Mostly Harmless");
      vi.mocked(accessor.getRoleRewardsAtLevel).mockResolvedValue([
        { level: 1, roleId: "role123" },
      ]);

      const result = await engine.awardXp({
        userId: "user1",
        guildId: "guild1",
        channelId: "ch1",
      });

      expect(result.newRoleIds).toEqual(["role123"]);
    });
  });

  describe("getUserStats", () => {
    let accessor: XpAccessor;
    let engine: XpEngine;

    beforeEach(() => {
      accessor = createMockAccessor();
      engine = new XpEngine(accessor, 15, 25, 60);
    });

    it("should return defaults for unknown user", async () => {
      vi.mocked(accessor.getUserXp).mockResolvedValue(null);

      const stats = await engine.getUserStats({ userId: "user1", guildId: "guild1" });

      expect(stats.found).toBe(false);
      expect(stats.xp).toBe(0);
      expect(stats.level).toBe(0);
      expect(stats.progressXp).toBe(0);
      expect(stats.requiredXp).toBe(155);
    });

    it("should return correct progress for existing user", async () => {
      vi.mocked(accessor.getUserXp).mockResolvedValue({ xp: 200, level: 1, lastXpAt: null });
      vi.mocked(accessor.getRankName).mockResolvedValue("Mostly Harmless");

      const stats = await engine.getUserStats({ userId: "user1", guildId: "guild1" });

      expect(stats.found).toBe(true);
      expect(stats.xp).toBe(200);
      expect(stats.level).toBe(1);
      expect(stats.rankName).toBe("Mostly Harmless");
      expect(stats.xpForCurrentLevel).toBe(155);
      expect(stats.xpForNextLevel).toBe(375);
      expect(stats.progressXp).toBe(45);
      expect(stats.requiredXp).toBe(220);
    });
  });

  describe("getLeaderboard", () => {
    let accessor: XpAccessor;
    let engine: XpEngine;

    beforeEach(() => {
      accessor = createMockAccessor();
      engine = new XpEngine(accessor, 15, 25, 60);
    });

    it("should return paginated results with positions", async () => {
      vi.mocked(accessor.countGuildUsers).mockResolvedValue(25);
      vi.mocked(accessor.getLeaderboard).mockResolvedValue([
        { userId: "u1", xp: 500, level: 2 },
        { userId: "u2", xp: 300, level: 1 },
      ]);
      vi.mocked(accessor.getRankName).mockResolvedValue("Test Rank");

      const result = await engine.getLeaderboard({
        guildId: "guild1",
        page: 1,
        pageSize: 10,
      });

      expect(result.totalPages).toBe(3);
      expect(result.totalUsers).toBe(25);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].position).toBe(1);
      expect(result.entries[1].position).toBe(2);
    });

    it("should calculate correct positions for page 2", async () => {
      vi.mocked(accessor.countGuildUsers).mockResolvedValue(15);
      vi.mocked(accessor.getLeaderboard).mockResolvedValue([
        { userId: "u11", xp: 100, level: 0 },
      ]);
      vi.mocked(accessor.getRankName).mockResolvedValue(null);

      const result = await engine.getLeaderboard({
        guildId: "guild1",
        page: 2,
        pageSize: 10,
      });

      expect(result.entries[0].position).toBe(11);
    });
  });

  describe("admin operations", () => {
    let accessor: XpAccessor;
    let engine: XpEngine;

    beforeEach(() => {
      accessor = createMockAccessor();
      engine = new XpEngine(accessor, 15, 25, 60);
    });

    it("setXp should compute correct level from XP", async () => {
      vi.mocked(accessor.getUserXp).mockResolvedValue({ xp: 100, level: 0, lastXpAt: null });

      const result = await engine.setXp({ userId: "u1", guildId: "g1", xp: 400 });

      expect(result.previousXp).toBe(100);
      expect(result.currentXp).toBe(400);
      expect(result.currentLevel).toBe(2);
      expect(accessor.setUserXp).toHaveBeenCalledWith("u1", "g1", 400, 2);
    });

    it("addXp should add to existing and recompute level", async () => {
      vi.mocked(accessor.getUserXp).mockResolvedValue({ xp: 100, level: 0, lastXpAt: null });

      const result = await engine.addXp({ userId: "u1", guildId: "g1", xp: 300 });

      expect(result.currentXp).toBe(400);
      expect(result.currentLevel).toBe(2);
    });

    it("resetXp should return previous values and zero out", async () => {
      vi.mocked(accessor.getUserXp).mockResolvedValue({ xp: 500, level: 2, lastXpAt: null });

      const result = await engine.resetXp({ userId: "u1", guildId: "g1" });

      expect(result.previousXp).toBe(500);
      expect(result.previousLevel).toBe(2);
      expect(result.currentXp).toBe(0);
      expect(result.currentLevel).toBe(0);
      expect(accessor.resetUserXp).toHaveBeenCalledWith("u1", "g1");
    });

    it("addXp should handle user with no existing record", async () => {
      vi.mocked(accessor.getUserXp).mockResolvedValue(null);

      const result = await engine.addXp({ userId: "u1", guildId: "g1", xp: 200 });

      expect(result.previousXp).toBe(0);
      expect(result.currentXp).toBe(200);
      expect(result.currentLevel).toBe(1);
    });
  });
});
