import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChallengeEngine, parseGenerateResponse, parseGradeResponse } from "./challenge-engine.js";
import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { ChallengeAccessor } from "../accessors/challenge-accessor.js";

function createMockOllama(): OllamaAccessor {
  return {
    chat: vi.fn(),
  } as unknown as OllamaAccessor;
}

function createMockAccessor(): ChallengeAccessor {
  return {
    createChallenge: vi.fn(),
    setChallengeMessageId: vi.fn(),
    getChallenge: vi.fn(),
    getLatestChallenge: vi.fn(),
    upsertSubmission: vi.fn(),
    getSubmissions: vi.fn(),
    getOpenChallengesDueBefore: vi.fn(),
    closeChallenge: vi.fn(),
    getLeaderboard: vi.fn(),
    getRecentDailyWords: vi.fn(),
  } as unknown as ChallengeAccessor;
}

describe("ChallengeEngine", () => {
  let ollama: OllamaAccessor;
  let accessor: ChallengeAccessor;
  let engine: ChallengeEngine;

  beforeEach(() => {
    ollama = createMockOllama();
    accessor = createMockAccessor();
    engine = new ChallengeEngine(ollama, accessor);
  });

  describe("parseGenerateResponse", () => {
    it("should parse a valid generate response", () => {
      const raw = [
        "SENTENCE: Ella camina por el parque.",
        "TRANSLATION: She walks through the park.",
        "CONTEXT: Uses the preposition 'por' meaning 'through'.",
      ].join("\n");

      const result = parseGenerateResponse(raw);
      expect(result).toEqual({
        sentence: "Ella camina por el parque.",
        referenceTranslation: "She walks through the park.",
        context: "Uses the preposition 'por' meaning 'through'.",
      });
    });

    it("should return null when sentence is missing", () => {
      const raw = "TRANSLATION: Hello\nCONTEXT: Simple";
      expect(parseGenerateResponse(raw)).toBeNull();
    });

    it("should return null when translation is missing", () => {
      const raw = "SENTENCE: Hola\nCONTEXT: Simple";
      expect(parseGenerateResponse(raw)).toBeNull();
    });

    it("should default context to empty string when missing", () => {
      const raw = "SENTENCE: Hola\nTRANSLATION: Hello";
      const result = parseGenerateResponse(raw);
      expect(result?.context).toBe("");
    });
  });

  describe("parseGradeResponse", () => {
    it("should parse a valid grade response", () => {
      const raw = [
        "ACCURACY: 8",
        "GRAMMAR: 7",
        "NATURALNESS: 9",
        "FEEDBACK: Good translation overall.",
      ].join("\n");

      const result = parseGradeResponse(raw);
      expect(result).toEqual({
        accuracyScore: 8,
        grammarScore: 7,
        naturalnessScore: 9,
        compositeScore: 8,
        feedback: "Good translation overall.",
      });
    });

    it("should clamp scores to 1-10 range", () => {
      const raw = "ACCURACY: 15\nGRAMMAR: 0\nNATURALNESS: 0\nFEEDBACK: Test";
      const result = parseGradeResponse(raw);
      expect(result?.accuracyScore).toBe(10);
      expect(result?.grammarScore).toBe(1);
      expect(result?.naturalnessScore).toBe(1);
    });

    it("should return null when scores are missing", () => {
      const raw = "ACCURACY: 8\nFEEDBACK: Missing other scores";
      expect(parseGradeResponse(raw)).toBeNull();
    });

    it("should default feedback to empty string when missing", () => {
      const raw = "ACCURACY: 8\nGRAMMAR: 7\nNATURALNESS: 9";
      const result = parseGradeResponse(raw);
      expect(result?.feedback).toBe("");
    });
  });

  describe("generateChallenge", () => {
    it("should generate a challenge from Ollama response", async () => {
      vi.mocked(ollama.chat).mockResolvedValue(
        "SENTENCE: La casa es grande.\nTRANSLATION: The house is big.\nCONTEXT: Uses ser for permanent quality.",
      );

      const result = await engine.generateChallenge({
        language: "ES",
        direction: "to_english",
      });

      expect(result.sentence).toBe("La casa es grande.");
      expect(result.referenceTranslation).toBe("The house is big.");
      expect(result.context).toBe("Uses ser for permanent quality.");
    });

    it("should throw when Ollama returns unparseable response", async () => {
      vi.mocked(ollama.chat).mockResolvedValue("Just some random text.");

      await expect(
        engine.generateChallenge({ language: "ES", direction: "to_english" }),
      ).rejects.toThrow("Failed to parse challenge sentence");
    });
  });

  describe("gradeSubmission", () => {
    it("should grade a submission from Ollama response", async () => {
      vi.mocked(ollama.chat).mockResolvedValue(
        "ACCURACY: 9\nGRAMMAR: 8\nNATURALNESS: 7\nFEEDBACK: Very good work!",
      );

      const result = await engine.gradeSubmission({
        sentence: "La casa es grande.",
        referenceTranslation: "The house is big.",
        userTranslation: "The house is large.",
        language: "ES",
        direction: "to_english",
      });

      expect(result.accuracyScore).toBe(9);
      expect(result.grammarScore).toBe(8);
      expect(result.naturalnessScore).toBe(7);
      expect(result.compositeScore).toBe(8);
      expect(result.feedback).toBe("Very good work!");
    });

    it("should throw when Ollama returns unparseable response", async () => {
      vi.mocked(ollama.chat).mockResolvedValue("I don't understand.");

      await expect(
        engine.gradeSubmission({
          sentence: "Hola",
          referenceTranslation: "Hello",
          userTranslation: "Hi",
          language: "ES",
          direction: "to_english",
        }),
      ).rejects.toThrow("Failed to parse grading response");
    });
  });

  describe("submitTranslation", () => {
    it("should return challenge_not_found when challenge does not exist", async () => {
      vi.mocked(accessor.getChallenge).mockResolvedValue(null);

      const result = await engine.submitTranslation({
        challengeId: 999,
        userId: "user1",
        translation: "Hello",
      });

      expect(result).toEqual({ success: false, reason: "challenge_not_found" });
    });

    it("should return challenge_closed when challenge is closed", async () => {
      vi.mocked(accessor.getChallenge).mockResolvedValue({
        id: 1,
        guildId: "g1",
        channelId: "c1",
        messageId: "m1",
        language: "ES",
        direction: "to_english",
        sentence: "Hola",
        referenceTranslation: "Hello",
        context: "",
        status: "closed",
        closesAt: 0,
        createdAt: 0,
      });

      const result = await engine.submitTranslation({
        challengeId: 1,
        userId: "user1",
        translation: "Hello",
      });

      expect(result).toEqual({ success: false, reason: "challenge_closed" });
    });

    it("should grade and save a valid submission", async () => {
      vi.mocked(accessor.getChallenge).mockResolvedValue({
        id: 1,
        guildId: "g1",
        channelId: "c1",
        messageId: "m1",
        language: "ES",
        direction: "to_english",
        sentence: "Hola",
        referenceTranslation: "Hello",
        context: "",
        status: "open",
        closesAt: Date.now() + 100000,
        createdAt: 0,
      });

      vi.mocked(ollama.chat).mockResolvedValue(
        "ACCURACY: 10\nGRAMMAR: 10\nNATURALNESS: 10\nFEEDBACK: Perfect!",
      );
      vi.mocked(accessor.upsertSubmission).mockResolvedValue("submitted");

      const result = await engine.submitTranslation({
        challengeId: 1,
        userId: "user1",
        translation: "Hello",
      });

      expect(result.success).toBe(true);
      expect(result.reason).toBe("submitted");
      expect(result.grade?.compositeScore).toBe(10);
      expect(accessor.upsertSubmission).toHaveBeenCalledOnce();
    });
  });

  describe("getResults", () => {
    it("should return null when challenge does not exist", async () => {
      vi.mocked(accessor.getChallenge).mockResolvedValue(null);

      const result = await engine.getResults({ challengeId: 999 });
      expect(result).toBeNull();
    });

    it("should return challenge with ranked submissions", async () => {
      vi.mocked(accessor.getChallenge).mockResolvedValue({
        id: 1,
        guildId: "g1",
        channelId: "c1",
        messageId: "m1",
        language: "ES",
        direction: "to_english",
        sentence: "Hola",
        referenceTranslation: "Hello",
        context: "A greeting.",
        status: "closed",
        closesAt: 0,
        createdAt: 0,
      });
      vi.mocked(accessor.getSubmissions).mockResolvedValue([
        {
          userId: "user1",
          translation: "Hello",
          compositeScore: 10,
          accuracyScore: 10,
          grammarScore: 10,
          naturalnessScore: 10,
          feedback: "Perfect",
          rank: 1,
        },
      ]);

      const result = await engine.getResults({ challengeId: 1 });
      expect(result?.submissions).toHaveLength(1);
      expect(result?.sentence).toBe("Hola");
    });
  });

  describe("getLeaderboard", () => {
    it("should delegate to accessor", async () => {
      vi.mocked(accessor.getLeaderboard).mockResolvedValue([
        { userId: "user1", totalChallenges: 5, averageScore: 8.5, totalScore: 42.5, position: 1 },
      ]);

      const result = await engine.getLeaderboard({ guildId: "g1" });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].averageScore).toBe(8.5);
    });
  });

  describe("closeExpiredChallenges", () => {
    it("should close expired challenges and return them", async () => {
      vi.mocked(accessor.getOpenChallengesDueBefore).mockResolvedValue([
        { id: 1, channelId: "c1", messageId: "m1" },
        { id: 2, channelId: "c2", messageId: "m2" },
      ]);

      const result = await engine.closeExpiredChallenges();

      expect(result).toHaveLength(2);
      expect(accessor.closeChallenge).toHaveBeenCalledTimes(2);
      expect(accessor.closeChallenge).toHaveBeenCalledWith(1);
      expect(accessor.closeChallenge).toHaveBeenCalledWith(2);
    });

    it("should return empty array when no challenges are expired", async () => {
      vi.mocked(accessor.getOpenChallengesDueBefore).mockResolvedValue([]);

      const result = await engine.closeExpiredChallenges();
      expect(result).toHaveLength(0);
      expect(accessor.closeChallenge).not.toHaveBeenCalled();
    });
  });
});
