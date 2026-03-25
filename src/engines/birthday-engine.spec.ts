import { describe, it, expect, vi, beforeEach } from "vitest";
import { BirthdayEngine } from "./birthday-engine.js";
import type { BirthdayAccessor } from "../accessors/birthday-accessor.js";

function createMockAccessor(): BirthdayAccessor {
  return {
    upsert: vi.fn(),
    remove: vi.fn(),
    removeAllForUser: vi.fn(),
    listForUser: vi.fn(),
    findAllForGuild: vi.fn(),
    findByDate: vi.fn(),
    findExact: vi.fn(),
  } as unknown as BirthdayAccessor;
}

describe("BirthdayEngine", () => {
  let accessor: BirthdayAccessor;
  let engine: BirthdayEngine;

  beforeEach(() => {
    accessor = createMockAccessor();
    engine = new BirthdayEngine(accessor);
  });

  describe("addBirthday", () => {
    it("should add a valid birthday", async () => {
      vi.mocked(accessor.upsert).mockResolvedValue("added");

      const result = await engine.addBirthday({
        guildId: "guild-1",
        userId: "user-1",
        personName: null,
        month: 7,
        day: 4,
      });

      expect(result).toEqual({ success: true, reason: "added" });
      expect(accessor.upsert).toHaveBeenCalledWith("guild-1", "user-1", null, 7, 4, "manual");
    });

    it("should return updated when birthday already exists", async () => {
      vi.mocked(accessor.upsert).mockResolvedValue("updated");

      const result = await engine.addBirthday({
        guildId: "guild-1",
        userId: "user-1",
        personName: null,
        month: 7,
        day: 4,
      });

      expect(result).toEqual({ success: true, reason: "updated" });
    });

    it("should reject invalid dates", async () => {
      const result = await engine.addBirthday({
        guildId: "guild-1",
        userId: "user-1",
        personName: null,
        month: 13,
        day: 1,
      });

      expect(result).toEqual({ success: false, reason: "invalid_date" });
      expect(accessor.upsert).not.toHaveBeenCalled();
    });

    it("should reject Feb 30", async () => {
      const result = await engine.addBirthday({
        guildId: "guild-1",
        userId: "user-1",
        personName: null,
        month: 2,
        day: 30,
      });

      expect(result).toEqual({ success: false, reason: "invalid_date" });
    });

    it("should allow Feb 29 (leap day)", async () => {
      vi.mocked(accessor.upsert).mockResolvedValue("added");

      const result = await engine.addBirthday({
        guildId: "guild-1",
        userId: "user-1",
        personName: null,
        month: 2,
        day: 29,
      });

      expect(result).toEqual({ success: true, reason: "added" });
    });

    it("should reject day 0", async () => {
      const result = await engine.addBirthday({
        guildId: "guild-1",
        userId: "user-1",
        personName: null,
        month: 1,
        day: 0,
      });

      expect(result).toEqual({ success: false, reason: "invalid_date" });
    });

    it("should store a family member birthday", async () => {
      vi.mocked(accessor.upsert).mockResolvedValue("added");

      const result = await engine.addBirthday({
        guildId: "guild-1",
        userId: "user-1",
        personName: "wife",
        month: 6,
        day: 1,
      });

      expect(result).toEqual({ success: true, reason: "added" });
      expect(accessor.upsert).toHaveBeenCalledWith("guild-1", "user-1", "wife", 6, 1, "manual");
    });
  });

  describe("removeBirthday", () => {
    it("should delegate to accessor and return result", async () => {
      vi.mocked(accessor.remove).mockResolvedValue(true);

      const result = await engine.removeBirthday({
        guildId: "guild-1",
        userId: "user-1",
        personName: null,
      });

      expect(result).toEqual({ removed: true });
    });

    it("should return false when nothing to remove", async () => {
      vi.mocked(accessor.remove).mockResolvedValue(false);

      const result = await engine.removeBirthday({
        guildId: "guild-1",
        userId: "user-1",
        personName: "wife",
      });

      expect(result).toEqual({ removed: false });
    });
  });

  describe("removeAllForUser", () => {
    it("should delegate to accessor", async () => {
      vi.mocked(accessor.removeAllForUser).mockResolvedValue(3);

      const count = await engine.removeAllForUser("guild-1", "user-1");

      expect(count).toBe(3);
      expect(accessor.removeAllForUser).toHaveBeenCalledWith("guild-1", "user-1");
    });
  });

  describe("getTodaysBirthdays", () => {
    it("should delegate to accessor", async () => {
      const entries = [
        { id: 1, userId: "user-1", personName: null, month: 3, day: 15, source: "manual" },
      ];
      vi.mocked(accessor.findByDate).mockResolvedValue(entries);

      const result = await engine.getTodaysBirthdays("guild-1", 3, 15);

      expect(result).toEqual(entries);
      expect(accessor.findByDate).toHaveBeenCalledWith("guild-1", 3, 15);
    });
  });

  describe("getAllBirthdays", () => {
    it("should delegate to accessor", async () => {
      const entries = [
        { id: 1, userId: "user-1", personName: null, month: 3, day: 15, source: "manual" },
        { id: 2, userId: "user-2", personName: "wife", month: 6, day: 1, source: "manual" },
      ];
      vi.mocked(accessor.findAllForGuild).mockResolvedValue(entries);

      const result = await engine.getAllBirthdays("guild-1");

      expect(result).toEqual(entries);
      expect(accessor.findAllForGuild).toHaveBeenCalledWith("guild-1");
    });
  });
});
