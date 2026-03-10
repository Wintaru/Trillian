export interface StartLessonRequest {
  userId: string;
  language: string;
}

export interface StartLessonResponse {
  sessionId: number;
  greeting: string;
}

export interface StopLessonRequest {
  userId: string;
}

export interface StopLessonResponse {
  ended: boolean;
  reason: "ended" | "no_active_session";
}

export interface LessonStatusRequest {
  userId: string;
}

export interface LessonStatusResponse {
  active: boolean;
  sessionId: number | null;
  language: string | null;
  startedAt: number | null;
}

export interface LessonMessageRequest {
  userId: string;
  content: string;
}

export interface LessonMessageResponse {
  reply: string;
}
