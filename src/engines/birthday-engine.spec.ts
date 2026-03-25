import { describe, it, expect, vi, beforeEach } from "vitest";
import { BirthdayEngine } from "./birthday-engine.js";
import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { BirthdayAccessor } from "../accessors/birthday-accessor.js";

function createMockOllama(): OllamaAccessor {
  return { chat: vi.fn() } as unknown as OllamaAccessor;
}

function createMockAccessor(): BirthdayAccessor {
  return {
    upsert: vi.fn(),
    remove: vi.fn(),
    removeAllForUser: vi.fn(),
    listForUser: vi.fn(),
    findByDate: vi.fn(),
    findExact: vi.fn(),
  } as unknown as BirthdayAccessor;
}

describe("BirthdayEngine", () => {
  let ollama: OllamaAccessor;
  let accessor: BirthdayAccessor;
  let engine: BirthdayEngine;

  beforeEach(() => {
    ollama = createMockOllama();
    accessor = createMockAccessor();
    engine = new BirthdayEngine(ollama, accessor);
  });

  describe("containsBirthdayKeyword", () => {
    it("should match 'birthday'", () => {
      expect(engine.containsBirthdayKeyword("my birthday is March 15")).toBe(true);
    });

    it("should match 'bday'", () => {
      expect(engine.containsBirthdayKeyword("my bday is soon")).toBe(true);
    });

    it("should match 'born on'", () => {
      expect(engine.containsBirthdayKeyword("I was born on July 4th")).toBe(true);
    });

    it("should be case insensitive", () => {
      expect(engine.containsBirthdayKeyword("Happy Birthday!")).toBe(true);
    });

    it("should match 'turns' with age", () => {
      expect(engine.containsBirthdayKeyword("my son turns 5 next Friday")).toBe(true);
    });

    it("should match 'turning' with age", () => {
      expect(engine.containsBirthdayKeyword("I'm turning 30 in April")).toBe(true);
    });

    it("should return false for unrelated text", () => {
      expect(engine.containsBirthdayKeyword("nice weather today")).toBe(false);
    });
  });

  describe("analyzeAndStore", () => {
    const baseRequest = {
      messageContent: "my birthday is March 15th",
      messageId: "msg-1",
      userId: "user-1",
      guildId: "guild-1",
      messageDate: new Date("2026-03-10T12:00:00Z"),
      mentionedUserIds: [] as string[],
    };

    it("should store a valid birthday detection", async () => {
      vi.mocked(ollama.chat).mockResolvedValue(
        JSON.stringify({ isBirthday: true, personName: null, month: 3, day: 15 }),
      );
      vi.mocked(accessor.upsert).mockResolvedValue("added");

      const result = await engine.analyzeAndStore(baseRequest);

      expect(result).toEqual({ stored: true, reason: "stored" });
      expect(accessor.upsert).toHaveBeenCalledWith("guild-1", "user-1", null, 3, 15, "detected");
    });

    it("should store a family member birthday", async () => {
      vi.mocked(ollama.chat).mockResolvedValue(
        JSON.stringify({ isBirthday: true, personName: "wife", month: 6, day: 1 }),
      );
      vi.mocked(accessor.upsert).mockResolvedValue("added");

      const result = await engine.analyzeAndStore({
        ...baseRequest,
        messageContent: "my wife's birthday is June 1st",
      });

      expect(result).toEqual({ stored: true, reason: "stored" });
      expect(accessor.upsert).toHaveBeenCalledWith("guild-1", "user-1", "wife", 6, 1, "detected");
    });

    it("should return not_birthday when Ollama says no", async () => {
      vi.mocked(ollama.chat).mockResolvedValue(JSON.stringify({ isBirthday: false }));

      const result = await engine.analyzeAndStore(baseRequest);

      expect(result).toEqual({ stored: false, reason: "not_birthday" });
      expect(accessor.upsert).not.toHaveBeenCalled();
    });

    it("should return parse_error for invalid JSON", async () => {
      vi.mocked(ollama.chat).mockResolvedValue("not json at all");

      const result = await engine.analyzeAndStore(baseRequest);

      expect(result).toEqual({ stored: false, reason: "parse_error" });
    });

    it("should return parse_error for invalid date", async () => {
      vi.mocked(ollama.chat).mockResolvedValue(
        JSON.stringify({ isBirthday: true, personName: null, month: 2, day: 30 }),
      );

      const result = await engine.analyzeAndStore(baseRequest);

      expect(result).toEqual({ stored: false, reason: "parse_error" });
      expect(accessor.upsert).not.toHaveBeenCalled();
    });

    it("should return parse_error when Ollama throws", async () => {
      vi.mocked(ollama.chat).mockRejectedValue(new Error("timeout"));

      const result = await engine.analyzeAndStore(baseRequest);

      expect(result).toEqual({ stored: false, reason: "parse_error" });
    });

    it("should handle markdown-wrapped JSON from Ollama", async () => {
      vi.mocked(ollama.chat).mockResolvedValue(
        '```json\n{"isBirthday": true, "personName": null, "month": 12, "day": 25}\n```',
      );
      vi.mocked(accessor.upsert).mockResolvedValue("added");

      const result = await engine.analyzeAndStore(baseRequest);

      expect(result).toEqual({ stored: true, reason: "stored" });
    });

    it("should attribute happy birthday wish to the mentioned user", async () => {
      vi.mocked(ollama.chat).mockResolvedValue(
        JSON.stringify({ isBirthday: true, personName: "@mentioned", month: 3, day: 10 }),
      );
      vi.mocked(accessor.upsert).mockResolvedValue("added");

      const result = await engine.analyzeAndStore({
        ...baseRequest,
        messageContent: "happy birthday <@target-user>!",
        mentionedUserIds: ["target-user"],
      });

      expect(result).toEqual({ stored: true, reason: "stored" });
      expect(accessor.upsert).toHaveBeenCalledWith("guild-1", "target-user", null, 3, 10, "detected");
    });

    it("should fall back to author when @mentioned but no mentions in message", async () => {
      vi.mocked(ollama.chat).mockResolvedValue(
        JSON.stringify({ isBirthday: true, personName: "@mentioned", month: 3, day: 10 }),
      );
      vi.mocked(accessor.upsert).mockResolvedValue("added");

      const result = await engine.analyzeAndStore(baseRequest);

      expect(result).toEqual({ stored: true, reason: "stored" });
      expect(accessor.upsert).toHaveBeenCalledWith("guild-1", "user-1", null, 3, 10, "detected");
    });
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
});
