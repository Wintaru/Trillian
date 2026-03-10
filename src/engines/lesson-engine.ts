import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { LessonAccessor } from "../accessors/lesson-accessor.js";
import type {
  StartLessonRequest,
  StartLessonResponse,
  StopLessonRequest,
  StopLessonResponse,
  LessonStatusRequest,
  LessonStatusResponse,
  LessonMessageRequest,
  LessonMessageResponse,
} from "../types/lesson-contracts.js";
import { languageName } from "./translate-engine.js";

const CONTEXT_WINDOW_SIZE = 20;

function buildLessonSystemPrompt(language: string): string {
  const name = languageName(language);
  return [
    `You are a friendly, patient language tutor teaching ${name}.`,
    ``,
    `Rules:`,
    `- Conduct the lesson primarily in ${name}, with English explanations when needed`,
    `- Correct the student's mistakes gently and explain why`,
    `- Introduce new vocabulary and grammar concepts progressively`,
    `- Ask follow-up questions to keep the conversation going`,
    `- Adapt to the student's level based on their responses`,
    `- Keep responses conversational and encouraging`,
    `- If the student writes in English, gently encourage them to try in ${name}`,
    `- Use simple ${name} at first and increase complexity as the student improves`,
  ].join("\n");
}

export class LessonEngine {
  constructor(
    private readonly ollamaAccessor: OllamaAccessor,
    private readonly lessonAccessor: LessonAccessor,
  ) {}

  async startLesson(request: StartLessonRequest): Promise<StartLessonResponse> {
    const existing = await this.lessonAccessor.getActiveSession(request.userId);
    if (existing) {
      throw new Error(`You already have an active ${languageName(existing.language)} lesson. Use \`/lesson stop\` to end it first.`);
    }

    const language = request.language.toUpperCase();
    const now = Date.now();
    const { id: sessionId } = await this.lessonAccessor.createSession(request.userId, language, now);

    const systemPrompt = buildLessonSystemPrompt(language);
    await this.lessonAccessor.insertMessage(sessionId, "system", systemPrompt, now);

    const greeting = await this.ollamaAccessor.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: "Start the lesson. Greet me and begin teaching." },
    ]);

    await this.lessonAccessor.insertMessage(sessionId, "assistant", greeting, Date.now());

    return { sessionId, greeting };
  }

  async stopLesson(request: StopLessonRequest): Promise<StopLessonResponse> {
    const session = await this.lessonAccessor.getActiveSession(request.userId);
    if (!session) {
      return { ended: false, reason: "no_active_session" };
    }

    await this.lessonAccessor.endSession(session.id, Date.now());
    return { ended: true, reason: "ended" };
  }

  async getStatus(request: LessonStatusRequest): Promise<LessonStatusResponse> {
    const session = await this.lessonAccessor.getActiveSession(request.userId);
    if (!session) {
      return { active: false, sessionId: null, language: null, startedAt: null };
    }

    return {
      active: true,
      sessionId: session.id,
      language: session.language,
      startedAt: session.startedAt,
    };
  }

  async processMessage(request: LessonMessageRequest): Promise<LessonMessageResponse> {
    const session = await this.lessonAccessor.getActiveSession(request.userId);
    if (!session) {
      throw new Error("No active lesson session.");
    }

    const now = Date.now();
    await this.lessonAccessor.insertMessage(session.id, "user", request.content, now);

    const messages = await this.lessonAccessor.getRecentMessages(session.id, CONTEXT_WINDOW_SIZE);
    const ollamaMessages = messages.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));

    const reply = await this.ollamaAccessor.chat(ollamaMessages);
    await this.lessonAccessor.insertMessage(session.id, "assistant", reply, Date.now());

    return { reply };
  }
}

export { buildLessonSystemPrompt };
