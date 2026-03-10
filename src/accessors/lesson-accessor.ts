import { eq, and, desc } from "drizzle-orm";
import { db } from "./database.js";
import { lessonSessions, lessonMessages } from "../db/schema.js";

export interface LessonSession {
  id: number;
  userId: string;
  language: string;
  status: string;
  startedAt: number;
  endedAt: number | null;
}

export class LessonAccessor {
  async getActiveSession(userId: string): Promise<LessonSession | null> {
    const rows = await db
      .select()
      .from(lessonSessions)
      .where(and(eq(lessonSessions.userId, userId), eq(lessonSessions.status, "active")))
      .limit(1);
    return rows[0] ?? null;
  }

  async createSession(userId: string, language: string, startedAt: number): Promise<{ id: number }> {
    const result = await db
      .insert(lessonSessions)
      .values({ userId, language, startedAt })
      .returning({ id: lessonSessions.id });
    return result[0];
  }

  async endSession(sessionId: number, endedAt: number): Promise<void> {
    await db
      .update(lessonSessions)
      .set({ status: "ended", endedAt })
      .where(eq(lessonSessions.id, sessionId));
  }

  async insertMessage(sessionId: number, role: string, content: string, createdAt: number): Promise<void> {
    await db
      .insert(lessonMessages)
      .values({ sessionId, role, content, createdAt });
  }

  async getRecentMessages(sessionId: number, limit: number): Promise<{ role: string; content: string }[]> {
    // Always get the system message (first message) plus the most recent messages
    const systemRows = await db
      .select({ role: lessonMessages.role, content: lessonMessages.content })
      .from(lessonMessages)
      .where(and(eq(lessonMessages.sessionId, sessionId), eq(lessonMessages.role, "system")))
      .limit(1);

    const recentRows = await db
      .select({ role: lessonMessages.role, content: lessonMessages.content })
      .from(lessonMessages)
      .where(and(
        eq(lessonMessages.sessionId, sessionId),
        // Exclude system messages from the recent query to avoid duplication
      ))
      .orderBy(desc(lessonMessages.id))
      .limit(limit);

    // recentRows is newest-first, reverse to chronological
    const chronological = recentRows.reverse();

    // If system message is already in the recent window, just return chronological
    if (chronological.length > 0 && chronological[0].role === "system") {
      return chronological;
    }

    // Otherwise prepend the system message
    return [...systemRows, ...chronological.filter((m) => m.role !== "system")];
  }

  async getMessageCount(sessionId: number): Promise<number> {
    const rows = await db
      .select({ id: lessonMessages.id })
      .from(lessonMessages)
      .where(eq(lessonMessages.sessionId, sessionId));
    return rows.length;
  }
}
