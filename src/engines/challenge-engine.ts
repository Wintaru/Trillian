import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { ChallengeAccessor } from "../accessors/challenge-accessor.js";
import type {
  GenerateChallengeRequest,
  GenerateChallengeResponse,
  GradeSubmissionRequest,
  GradeSubmissionResponse,
  SubmitChallengeRequest,
  SubmitChallengeResponse,
  ChallengeResultsRequest,
  ChallengeResultsResponse,
  ChallengeLeaderboardRequest,
  ChallengeLeaderboardResponse,
} from "../types/challenge-contracts.js";
import { languageName } from "./translate-engine.js";

function buildGeneratePrompt(language: string, direction: string, recentWords?: string[]): string {
  const name = languageName(language);
  const directionText = direction === "to_english"
    ? `Generate a sentence in ${name} that a user will translate to English.`
    : `Generate a sentence in English that a user will translate to ${name}.`;

  const wordHint = recentWords && recentWords.length > 0
    ? `\nTry to incorporate one of these vocabulary words if it fits naturally: ${recentWords.join(", ")}.`
    : "";

  return [
    `You are a language teacher specializing in ${name}.`,
    directionText,
    `The sentence should be appropriate for an intermediate learner — not trivially simple, but not advanced either.`,
    wordHint,
    ``,
    `Respond EXACTLY in this format:`,
    `SENTENCE: <the sentence>`,
    `TRANSLATION: <the correct translation>`,
    `CONTEXT: <1-2 sentences explaining grammar points, idioms, or cultural context>`,
  ].join("\n");
}

function buildGradePrompt(
  sentence: string,
  referenceTranslation: string,
  userTranslation: string,
  language: string,
  direction: string,
): string {
  const name = languageName(language);
  const dirLabel = direction === "to_english"
    ? `from ${name} to English`
    : `from English to ${name}`;

  return [
    `You are a strict but fair language teacher grading a translation ${dirLabel}.`,
    ``,
    `Original sentence: ${sentence}`,
    `Reference translation: ${referenceTranslation}`,
    `Student's translation: ${userTranslation}`,
    ``,
    `Grade the student's translation on three criteria, each on a scale of 1-10:`,
    `- ACCURACY: How closely the meaning matches the original (10 = perfect meaning, 1 = completely wrong)`,
    `- GRAMMAR: Correctness of grammar and syntax (10 = flawless, 1 = incomprehensible)`,
    `- NATURALNESS: How natural and fluent it sounds to a native speaker (10 = perfectly natural, 1 = very awkward)`,
    ``,
    `Respond EXACTLY in this format:`,
    `ACCURACY: <number 1-10>`,
    `GRAMMAR: <number 1-10>`,
    `NATURALNESS: <number 1-10>`,
    `FEEDBACK: <2-3 sentences of constructive feedback>`,
  ].join("\n");
}

function parseGenerateResponse(raw: string): GenerateChallengeResponse | null {
  const sentenceMatch = raw.match(/SENTENCE:\s*(.+)/);
  const translationMatch = raw.match(/TRANSLATION:\s*(.+)/);
  const contextMatch = raw.match(/CONTEXT:\s*(.+)/s);

  const sentence = sentenceMatch?.[1]?.trim();
  const referenceTranslation = translationMatch?.[1]?.trim();

  if (!sentence || !referenceTranslation) return null;

  return {
    sentence,
    referenceTranslation,
    context: contextMatch?.[1]?.trim() ?? "",
  };
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function parseGradeResponse(raw: string): GradeSubmissionResponse | null {
  const accuracyMatch = raw.match(/ACCURACY:\s*(\d+)/);
  const grammarMatch = raw.match(/GRAMMAR:\s*(\d+)/);
  const naturalnessMatch = raw.match(/NATURALNESS:\s*(\d+)/);
  const feedbackMatch = raw.match(/FEEDBACK:\s*(.+)/s);

  if (!accuracyMatch || !grammarMatch || !naturalnessMatch) return null;

  const accuracyScore = clampScore(parseInt(accuracyMatch[1], 10));
  const grammarScore = clampScore(parseInt(grammarMatch[1], 10));
  const naturalnessScore = clampScore(parseInt(naturalnessMatch[1], 10));
  const compositeScore = Math.round(((accuracyScore + grammarScore + naturalnessScore) / 3) * 10) / 10;

  return {
    accuracyScore,
    grammarScore,
    naturalnessScore,
    compositeScore,
    feedback: feedbackMatch?.[1]?.trim() ?? "",
  };
}

export class ChallengeEngine {
  constructor(
    private readonly ollamaAccessor: OllamaAccessor,
    private readonly challengeAccessor: ChallengeAccessor,
  ) {}

  async generateChallenge(request: GenerateChallengeRequest): Promise<GenerateChallengeResponse> {
    const language = request.language.toUpperCase();
    const prompt = buildGeneratePrompt(language, request.direction, request.recentWords);

    const raw = await this.ollamaAccessor.chat([
      { role: "system", content: prompt },
      { role: "user", content: "Generate a translation challenge sentence." },
    ]);

    const parsed = parseGenerateResponse(raw);
    if (!parsed) {
      throw new Error("Failed to parse challenge sentence from Ollama response.");
    }

    return parsed;
  }

  async gradeSubmission(request: GradeSubmissionRequest): Promise<GradeSubmissionResponse> {
    const prompt = buildGradePrompt(
      request.sentence,
      request.referenceTranslation,
      request.userTranslation,
      request.language,
      request.direction,
    );

    const raw = await this.ollamaAccessor.chat([
      { role: "user", content: prompt },
    ]);

    const parsed = parseGradeResponse(raw);
    if (!parsed) {
      throw new Error("Failed to parse grading response from Ollama.");
    }

    return parsed;
  }

  async submitTranslation(request: SubmitChallengeRequest): Promise<SubmitChallengeResponse> {
    const challenge = await this.challengeAccessor.getChallenge(request.challengeId);
    if (!challenge) {
      return { success: false, reason: "challenge_not_found" };
    }

    if (challenge.status !== "open") {
      return { success: false, reason: "challenge_closed" };
    }

    const grade = await this.gradeSubmission({
      sentence: challenge.sentence,
      referenceTranslation: challenge.referenceTranslation,
      userTranslation: request.translation,
      language: challenge.language,
      direction: challenge.direction as "to_english" | "from_english",
    });

    const reason = await this.challengeAccessor.upsertSubmission(
      request.challengeId,
      request.userId,
      request.translation,
      {
        accuracyScore: grade.accuracyScore,
        grammarScore: grade.grammarScore,
        naturalnessScore: grade.naturalnessScore,
        compositeScore: grade.compositeScore,
      },
      grade.feedback,
      Date.now(),
    );

    return { success: true, reason, grade };
  }

  async getResults(request: ChallengeResultsRequest): Promise<ChallengeResultsResponse | null> {
    const challenge = await this.challengeAccessor.getChallenge(request.challengeId);
    if (!challenge) return null;

    const submissions = await this.challengeAccessor.getSubmissions(request.challengeId);

    return {
      challengeId: challenge.id,
      sentence: challenge.sentence,
      referenceTranslation: challenge.referenceTranslation,
      language: challenge.language,
      direction: challenge.direction as "to_english" | "from_english",
      context: challenge.context,
      status: challenge.status as "open" | "closed",
      closesAt: challenge.closesAt,
      submissions,
    };
  }

  async getLatestResults(guildId: string): Promise<ChallengeResultsResponse | null> {
    const challenge = await this.challengeAccessor.getLatestChallenge(guildId);
    if (!challenge) return null;
    return this.getResults({ challengeId: challenge.id });
  }

  async getLeaderboard(request: ChallengeLeaderboardRequest): Promise<ChallengeLeaderboardResponse> {
    const entries = await this.challengeAccessor.getLeaderboard(request.guildId);
    return { entries };
  }

  async closeExpiredChallenges(): Promise<{ id: number; channelId: string; messageId: string }[]> {
    const expired = await this.challengeAccessor.getOpenChallengesDueBefore(Date.now());
    for (const challenge of expired) {
      await this.challengeAccessor.closeChallenge(challenge.id);
    }
    return expired;
  }
}

export { buildGeneratePrompt, buildGradePrompt, parseGenerateResponse, parseGradeResponse };
