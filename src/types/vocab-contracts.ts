export interface GenerateWordRequest {
  language: string;
}

export interface GenerateWordResponse {
  word: string;
  language: string;
  translation: string;
  pronunciation: string;
  exampleSentence: string;
  exampleTranslation: string;
  linguisticNotes: string;
}

export interface SaveVocabRequest {
  userId: string;
  dailyWordId: number;
}

export interface SaveVocabResponse {
  saved: boolean;
  reason: "saved" | "already_saved";
}

export interface VocabQuizRequest {
  userId: string;
}

export interface VocabQuizResponse {
  word: string;
  language: string;
  options: string[];
  correctIndex: number;
  dailyWordId: number;
}

export interface VocabAnswerRequest {
  userId: string;
  dailyWordId: number;
  selectedIndex: number;
  correctIndex: number;
}

export interface VocabAnswerResponse {
  correct: boolean;
  correctAnswer: string;
  reviewCount: number;
  correctCount: number;
}

export interface VocabListEntry {
  dailyWordId: number;
  word: string;
  language: string;
  translation: string;
  reviewCount: number;
  correctCount: number;
  savedAt: number;
}

export interface VocabStatsRequest {
  userId: string;
}

export interface VocabStatsResponse {
  totalWords: number;
  totalReviews: number;
  totalCorrect: number;
  accuracy: number;
}
