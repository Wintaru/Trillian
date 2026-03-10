import { describe, it, expect, vi, beforeEach } from "vitest";
import { VocabEngine, buildVocabSystemPrompt, parseVocabResponse } from "./vocab-engine.js";
import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { VocabAccessor } from "../accessors/vocab-accessor.js";

function createMockOllama(): OllamaAccessor {
  return { chat: vi.fn() } as unknown as OllamaAccessor;
}

function createMockVocabAccessor(): VocabAccessor {
  return {
    insertDailyWord: vi.fn(),
    hasWordBeenPosted: vi.fn(),
    saveUserWord: vi.fn(),
    getUserVocab: vi.fn(),
    getDueQuizWord: vi.fn(),
    getDistractors: vi.fn(),
    recordReview: vi.fn(),
    getUserStats: vi.fn(),
    getDueWord: vi.fn(),
    getWordById: vi.fn(),
    getSrsState: vi.fn().mockResolvedValue({ easeFactor: 2.5, interval: 0, repetition: 0 }),
    updateSrsState: vi.fn(),
    getNextDueDate: vi.fn(),
  } as unknown as VocabAccessor;
}

const OLLAMA_VOCAB_RESPONSE = [
  "WORD: hola",
  "TRANSLATION: hello",
  "PRONUNCIATION: OH-lah",
  "EXAMPLE: ¡Hola, cómo estás?",
  "EXAMPLE_TRANSLATION: Hello, how are you?",
  "NOTES: One of the most common Spanish greetings, used in both formal and informal contexts.",
].join("\n");

describe("VocabEngine", () => {
  let ollama: OllamaAccessor;
  let accessor: VocabAccessor;
  let engine: VocabEngine;

  beforeEach(() => {
    ollama = createMockOllama();
    accessor = createMockVocabAccessor();
    engine = new VocabEngine(ollama, accessor);
  });

  describe("generateWord", () => {
    it("should generate and return a parsed word", async () => {
      vi.mocked(ollama.chat).mockResolvedValue(OLLAMA_VOCAB_RESPONSE);
      vi.mocked(accessor.hasWordBeenPosted).mockResolvedValue(false);

      const result = await engine.generateWord({ language: "ES" });

      expect(result.word).toBe("hola");
      expect(result.translation).toBe("hello");
      expect(result.pronunciation).toBe("OH-lah");
      expect(result.exampleSentence).toBe("¡Hola, cómo estás?");
      expect(result.exampleTranslation).toBe("Hello, how are you?");
      expect(result.linguisticNotes).toContain("common Spanish greetings");
      expect(result.language).toBe("ES");
    });

    it("should retry when word is a duplicate", async () => {
      vi.mocked(ollama.chat)
        .mockResolvedValueOnce(OLLAMA_VOCAB_RESPONSE)
        .mockResolvedValueOnce(
          "WORD: adiós\nTRANSLATION: goodbye\nPRONUNCIATION: ah-dee-OHS\nEXAMPLE: Adiós amigo.\nEXAMPLE_TRANSLATION: Goodbye friend.\nNOTES: Standard farewell.",
        );
      vi.mocked(accessor.hasWordBeenPosted)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await engine.generateWord({ language: "ES" });

      expect(result.word).toBe("adiós");
      expect(vi.mocked(ollama.chat)).toHaveBeenCalledTimes(2);
    });

    it("should include excluded words in retry prompt", async () => {
      vi.mocked(ollama.chat)
        .mockResolvedValueOnce(OLLAMA_VOCAB_RESPONSE)
        .mockResolvedValueOnce(
          "WORD: gracias\nTRANSLATION: thank you\nPRONUNCIATION: GRAH-see-ahs\nEXAMPLE: Gracias por todo.\nEXAMPLE_TRANSLATION: Thank you for everything.\nNOTES: Essential courtesy word.",
        );
      vi.mocked(accessor.hasWordBeenPosted)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await engine.generateWord({ language: "ES" });

      const secondCall = vi.mocked(ollama.chat).mock.calls[1];
      const userMessage = secondCall[0].find((m) => m.role === "user");
      expect(userMessage?.content).toContain("hola");
    });

    it("should throw when Ollama returns unparseable response", async () => {
      vi.mocked(ollama.chat).mockResolvedValue("Something random with no labels");
      vi.mocked(accessor.hasWordBeenPosted).mockResolvedValue(false);

      await expect(engine.generateWord({ language: "ES" })).rejects.toThrow(
        "Failed to parse vocabulary word",
      );
    });
  });

  describe("saveWord", () => {
    it("should delegate to accessor", async () => {
      vi.mocked(accessor.saveUserWord).mockResolvedValue({ saved: true, reason: "saved" });

      const result = await engine.saveWord({ userId: "123", dailyWordId: 1 });

      expect(result.reason).toBe("saved");
      expect(vi.mocked(accessor.saveUserWord)).toHaveBeenCalledWith("123", 1, expect.any(Number));
    });
  });

  describe("getQuiz", () => {
    it("should return null when user has no saved words", async () => {
      vi.mocked(accessor.getDueQuizWord).mockResolvedValue(null);

      const result = await engine.getQuiz({ userId: "123" });

      expect(result).toBeNull();
    });

    it("should return quiz with shuffled options", async () => {
      vi.mocked(accessor.getDueQuizWord).mockResolvedValue({
        dailyWordId: 1,
        word: "hola",
        language: "ES",
        translation: "hello",
      });
      vi.mocked(accessor.getDistractors).mockResolvedValue(["goodbye", "please", "thanks"]);

      const result = await engine.getQuiz({ userId: "123" });

      expect(result).not.toBeNull();
      expect(result!.word).toBe("hola");
      expect(result!.options).toHaveLength(4);
      expect(result!.options).toContain("hello");
      expect(result!.options).toContain("goodbye");
      expect(result!.options).toContain("please");
      expect(result!.options).toContain("thanks");
      expect(result!.correctIndex).toBe(result!.options.indexOf("hello"));
    });
  });

  describe("answerQuiz", () => {
    it("should record correct answer and update SRS state", async () => {
      vi.mocked(accessor.recordReview).mockResolvedValue({ reviewCount: 5, correctCount: 4 });
      vi.mocked(accessor.getUserVocab).mockResolvedValue([
        { dailyWordId: 1, word: "hola", language: "ES", translation: "hello", reviewCount: 5, correctCount: 4, savedAt: 0, nextReviewAt: null },
      ]);

      const result = await engine.answerQuiz({
        userId: "123",
        dailyWordId: 1,
        selectedIndex: 2,
        correctIndex: 2,
      });

      expect(result.correct).toBe(true);
      expect(result.correctAnswer).toBe("hello");
      expect(vi.mocked(accessor.getSrsState)).toHaveBeenCalledWith("123", 1);
      expect(vi.mocked(accessor.updateSrsState)).toHaveBeenCalledWith("123", 1, expect.objectContaining({
        interval: 1,
        repetition: 1,
      }));
    });

    it("should record incorrect answer and reset SRS state", async () => {
      vi.mocked(accessor.recordReview).mockResolvedValue({ reviewCount: 3, correctCount: 1 });
      vi.mocked(accessor.getSrsState).mockResolvedValue({ easeFactor: 2.5, interval: 6, repetition: 2 });
      vi.mocked(accessor.getUserVocab).mockResolvedValue([
        { dailyWordId: 1, word: "hola", language: "ES", translation: "hello", reviewCount: 3, correctCount: 1, savedAt: 0, nextReviewAt: null },
      ]);

      const result = await engine.answerQuiz({
        userId: "123",
        dailyWordId: 1,
        selectedIndex: 0,
        correctIndex: 2,
      });

      expect(result.correct).toBe(false);
      expect(vi.mocked(accessor.updateSrsState)).toHaveBeenCalledWith("123", 1, expect.objectContaining({
        interval: 1,
        repetition: 0,
      }));
    });
  });

  describe("getStats", () => {
    it("should delegate to accessor", async () => {
      const stats = { totalWords: 10, totalReviews: 50, totalCorrect: 40, accuracy: 80 };
      vi.mocked(accessor.getUserStats).mockResolvedValue(stats);

      const result = await engine.getStats({ userId: "123" });

      expect(result).toEqual(stats);
    });
  });

  describe("getFlashcard", () => {
    it("should return due word when available", async () => {
      vi.mocked(accessor.getDueWord).mockResolvedValue({
        dailyWordId: 1,
        word: "hola",
        language: "ES",
        translation: "hello",
        pronunciation: "OH-lah",
        exampleSentence: "¡Hola!",
        exampleTranslation: "Hello!",
      });

      const result = await engine.getFlashcard({ userId: "123" });

      expect(result).not.toBeNull();
      expect(result!.word).toBe("hola");
      expect(result!.translation).toBe("hello");
    });

    it("should return null when no words are due", async () => {
      vi.mocked(accessor.getDueWord).mockResolvedValue(null);

      const result = await engine.getFlashcard({ userId: "123" });

      expect(result).toBeNull();
    });
  });

  describe("rateFlashcard", () => {
    it("should record review and update SRS state", async () => {
      vi.mocked(accessor.recordReview).mockResolvedValue({ reviewCount: 1, correctCount: 1 });
      vi.mocked(accessor.getSrsState).mockResolvedValue({ easeFactor: 2.5, interval: 0, repetition: 0 });

      const result = await engine.rateFlashcard({ userId: "123", dailyWordId: 1, quality: 4 });

      expect(result.interval).toBe(1);
      expect(result.nextReviewAt).toBeGreaterThan(Date.now());
      expect(vi.mocked(accessor.recordReview)).toHaveBeenCalledWith("123", 1, true);
      expect(vi.mocked(accessor.updateSrsState)).toHaveBeenCalled();
    });

    it("should mark as incorrect for quality < 3", async () => {
      vi.mocked(accessor.recordReview).mockResolvedValue({ reviewCount: 1, correctCount: 0 });
      vi.mocked(accessor.getSrsState).mockResolvedValue({ easeFactor: 2.5, interval: 6, repetition: 2 });

      const result = await engine.rateFlashcard({ userId: "123", dailyWordId: 1, quality: 0 });

      expect(result.interval).toBe(1);
      expect(vi.mocked(accessor.recordReview)).toHaveBeenCalledWith("123", 1, false);
    });
  });
});

describe("buildVocabSystemPrompt", () => {
  it("should include language name in prompt", () => {
    const prompt = buildVocabSystemPrompt("ES");
    expect(prompt).toContain("Spanish");
    expect(prompt).toContain("WORD:");
    expect(prompt).toContain("TRANSLATION:");
  });
});

describe("parseVocabResponse", () => {
  it("should parse a complete structured response", () => {
    const result = parseVocabResponse(OLLAMA_VOCAB_RESPONSE, "ES");

    expect(result).not.toBeNull();
    expect(result!.word).toBe("hola");
    expect(result!.translation).toBe("hello");
    expect(result!.pronunciation).toBe("OH-lah");
    expect(result!.language).toBe("ES");
  });

  it("should return null when WORD label is missing", () => {
    const result = parseVocabResponse("TRANSLATION: hello", "ES");
    expect(result).toBeNull();
  });

  it("should return null when TRANSLATION label is missing", () => {
    const result = parseVocabResponse("WORD: hola", "ES");
    expect(result).toBeNull();
  });

  it("should handle missing optional fields", () => {
    const raw = "WORD: hola\nTRANSLATION: hello";
    const result = parseVocabResponse(raw, "ES");

    expect(result).not.toBeNull();
    expect(result!.word).toBe("hola");
    expect(result!.pronunciation).toBe("");
    expect(result!.exampleSentence).toBe("");
  });
});
