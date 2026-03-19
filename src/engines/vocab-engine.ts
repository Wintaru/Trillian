import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { VocabAccessor } from "../accessors/vocab-accessor.js";
import type {
  GenerateWordRequest,
  GenerateWordResponse,
  SaveVocabRequest,
  SaveVocabResponse,
  VocabQuizRequest,
  VocabQuizResponse,
  VocabAnswerRequest,
  VocabAnswerResponse,
  VocabListEntry,
  VocabStatsRequest,
  VocabStatsResponse,
  VocabFlashcardRequest,
  VocabFlashcardResponse,
  VocabFlashcardRateRequest,
  VocabFlashcardRateResponse,
} from "../types/vocab-contracts.js";
import { languageName } from "./translate-engine.js";
import { calculateSm2, SM2_QUALITY_AGAIN, SM2_QUALITY_GOOD } from "../utilities/sm2.js";

const MAX_GENERATION_RETRIES = 3;

function buildVocabSystemPrompt(language: string): string {
  const name = languageName(language);
  return [
    `You are a vocabulary teacher specializing in ${name}.`,
    `Generate a single vocabulary word that a casual learner would find useful and interesting.`,
    `Avoid basic greetings, numbers, colors, days, months, and common textbook words.`,
    `Prefer words with cultural significance, interesting etymology, useful everyday applications, or surprising nuances.`,
    ``,
    `Respond EXACTLY in this format (keep the labels on their own lines):`,
    `WORD: <the word in ${name}>`,
    `TRANSLATION: <English translation>`,
    `PRONUNCIATION: <phonetic pronunciation guide>`,
    `EXAMPLE: <example sentence using the word in ${name}>`,
    `EXAMPLE_TRANSLATION: <English translation of the example sentence>`,
    `NOTES: <1-3 sentences about grammar, etymology, usage, or cultural context>`,
  ].join("\n");
}

function parseVocabResponse(raw: string, language: string): GenerateWordResponse | null {
  const wordMatch = raw.match(/WORD:\s*(.+)/);
  const translationMatch = raw.match(/TRANSLATION:\s*(.+)/);
  const pronunciationMatch = raw.match(/PRONUNCIATION:\s*(.+)/);
  const exampleMatch = raw.match(/EXAMPLE:\s*(.+)/);
  const exampleTranslationMatch = raw.match(/EXAMPLE_TRANSLATION:\s*(.+)/);
  const notesMatch = raw.match(/NOTES:\s*(.+)/s);

  const word = wordMatch?.[1]?.trim();
  const translation = translationMatch?.[1]?.trim();

  if (!word || !translation) return null;

  return {
    word,
    language,
    translation,
    pronunciation: pronunciationMatch?.[1]?.trim() ?? "",
    exampleSentence: exampleMatch?.[1]?.trim() ?? "",
    exampleTranslation: exampleTranslationMatch?.[1]?.trim() ?? "",
    linguisticNotes: notesMatch?.[1]?.trim() ?? "",
  };
}

export class VocabEngine {
  constructor(
    private readonly ollamaAccessor: OllamaAccessor,
    private readonly vocabAccessor: VocabAccessor,
  ) {}

  async generateWord(request: GenerateWordRequest): Promise<GenerateWordResponse> {
    const language = request.language.toUpperCase();
    const systemPrompt = buildVocabSystemPrompt(language);
    const excluded: string[] = [];

    for (let attempt = 0; attempt <= MAX_GENERATION_RETRIES; attempt++) {
      const userMessage = excluded.length > 0
        ? `Generate a different word, not: ${excluded.join(", ")}.`
        : "Generate a word of the day.";

      const raw = await this.ollamaAccessor.chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ]);

      const parsed = parseVocabResponse(raw, language);
      if (!parsed) {
        throw new Error("Failed to parse vocabulary word from Ollama response.");
      }

      const isDuplicate = await this.vocabAccessor.hasWordBeenPosted(parsed.word, language);
      if (!isDuplicate) return parsed;

      excluded.push(parsed.word);
    }

    // All retries produced duplicates — use the last one anyway
    const lastWord = excluded[excluded.length - 1];
    return {
      word: lastWord,
      language,
      translation: "",
      pronunciation: "",
      exampleSentence: "",
      exampleTranslation: "",
      linguisticNotes: "",
    };
  }

  async saveWord(request: SaveVocabRequest): Promise<SaveVocabResponse> {
    return this.vocabAccessor.saveUserWord(request.userId, request.dailyWordId, Date.now());
  }

  async getQuiz(request: VocabQuizRequest): Promise<VocabQuizResponse | null> {
    const quizWord = await this.vocabAccessor.getDueQuizWord(request.userId, Date.now());
    if (!quizWord) return null;

    const distractors = await this.vocabAccessor.getDistractors(
      quizWord.dailyWordId,
      quizWord.language,
      3,
    );

    const options = [...distractors, quizWord.translation];
    shuffleArray(options);

    const correctIndex = options.indexOf(quizWord.translation);

    return {
      word: quizWord.word,
      language: quizWord.language,
      options,
      correctIndex,
      dailyWordId: quizWord.dailyWordId,
    };
  }

  async answerQuiz(request: VocabAnswerRequest): Promise<VocabAnswerResponse> {
    const correct = request.selectedIndex === request.correctIndex;
    const stats = await this.vocabAccessor.recordReview(
      request.userId,
      request.dailyWordId,
      correct,
    );

    // Update SRS state based on quiz result
    const now = Date.now();
    const srsState = await this.vocabAccessor.getSrsState(request.userId, request.dailyWordId);
    const quality = correct ? SM2_QUALITY_GOOD : SM2_QUALITY_AGAIN;
    const srsResult = calculateSm2(srsState, quality, now);
    await this.vocabAccessor.updateSrsState(request.userId, request.dailyWordId, {
      ...srsResult,
      lastReviewedAt: now,
    });

    const vocab = await this.vocabAccessor.getUserVocab(request.userId);
    const entry = vocab.find((v) => v.dailyWordId === request.dailyWordId);

    return {
      correct,
      correctAnswer: entry?.translation ?? "",
      reviewCount: stats.reviewCount,
      correctCount: stats.correctCount,
    };
  }

  async listVocab(userId: string): Promise<VocabListEntry[]> {
    return this.vocabAccessor.getUserVocab(userId);
  }

  async getStats(request: VocabStatsRequest): Promise<VocabStatsResponse> {
    return this.vocabAccessor.getUserStats(request.userId);
  }

  async getFlashcardByWordId(userId: string, dailyWordId: number): Promise<VocabFlashcardResponse | null> {
    return this.vocabAccessor.getWordById(dailyWordId);
  }

  async getFlashcard(request: VocabFlashcardRequest): Promise<VocabFlashcardResponse | null> {
    const word = await this.vocabAccessor.getDueWord(request.userId, Date.now());
    if (!word) return null;
    return word;
  }

  async rateFlashcard(request: VocabFlashcardRateRequest): Promise<VocabFlashcardRateResponse> {
    const now = Date.now();
    const correct = request.quality >= 3;

    await this.vocabAccessor.recordReview(request.userId, request.dailyWordId, correct);

    const srsState = await this.vocabAccessor.getSrsState(request.userId, request.dailyWordId);
    const srsResult = calculateSm2(srsState, request.quality, now);
    await this.vocabAccessor.updateSrsState(request.userId, request.dailyWordId, {
      ...srsResult,
      lastReviewedAt: now,
    });

    return {
      nextReviewAt: srsResult.nextReviewAt,
      interval: srsResult.interval,
      easeFactor: srsResult.easeFactor,
    };
  }

  async getNextDueDate(userId: string): Promise<number | null> {
    return this.vocabAccessor.getNextDueDate(userId);
  }
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export { buildVocabSystemPrompt, parseVocabResponse };
