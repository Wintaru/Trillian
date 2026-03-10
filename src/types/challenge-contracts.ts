export interface GenerateChallengeRequest {
  language: string;
  direction: "to_english" | "from_english";
  recentWords?: string[];
}

export interface GenerateChallengeResponse {
  sentence: string;
  referenceTranslation: string;
  context: string;
}

export interface GradeSubmissionRequest {
  sentence: string;
  referenceTranslation: string;
  userTranslation: string;
  language: string;
  direction: "to_english" | "from_english";
}

export interface GradeSubmissionResponse {
  accuracyScore: number;
  grammarScore: number;
  naturalnessScore: number;
  compositeScore: number;
  feedback: string;
}

export interface SubmitChallengeRequest {
  challengeId: number;
  userId: string;
  translation: string;
}

export interface SubmitChallengeResponse {
  success: boolean;
  reason: "submitted" | "resubmitted" | "challenge_closed" | "challenge_not_found";
  grade?: GradeSubmissionResponse;
}

export interface ChallengeResultsRequest {
  challengeId: number;
}

export interface ChallengeResultsResponse {
  challengeId: number;
  sentence: string;
  referenceTranslation: string;
  language: string;
  direction: "to_english" | "from_english";
  context: string;
  status: "open" | "closed";
  closesAt: number;
  submissions: ChallengeSubmissionEntry[];
}

export interface ChallengeSubmissionEntry {
  userId: string;
  translation: string;
  compositeScore: number;
  accuracyScore: number;
  grammarScore: number;
  naturalnessScore: number;
  feedback: string;
  rank: number;
}

export interface ChallengeLeaderboardRequest {
  guildId: string;
}

export interface ChallengeLeaderboardResponse {
  entries: ChallengeLeaderboardEntry[];
}

export interface ChallengeLeaderboardEntry {
  userId: string;
  totalChallenges: number;
  averageScore: number;
  totalScore: number;
  position: number;
}
