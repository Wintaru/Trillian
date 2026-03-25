import type { OllamaAccessor } from "../accessors/ollama-accessor.js";
import type { BirthdayAccessor } from "../accessors/birthday-accessor.js";
import type {
  AnalyzeBirthdayRequest,
  AnalyzeBirthdayResponse,
  AddBirthdayRequest,
  AddBirthdayResponse,
  RemoveBirthdayRequest,
  RemoveBirthdayResponse,
  BirthdayEntry,
  OllamaBirthdayResult,
} from "../types/birthday-contracts.js";
import * as logger from "../utilities/logger.js";

const BIRTHDAY_KEYWORD_REGEX = /birthday|bday|b-day|born on|turns \d|turning \d/i;

const DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const ANALYZE_PROMPT = `You are analyzing a Discord message to determine if it mentions someone's birthday.

You will be told the date the message was posted. Use this to resolve relative dates like "tomorrow", "Thursday", "next week", "this Friday", etc.

Respond with ONLY valid JSON (no markdown fences).

If the message mentions a specific person's birthday AND you can determine the date (month and day):
{
  "isBirthday": true,
  "personName": "wife" or "Mom" or "son Jake" or null,
  "month": 3,
  "day": 15
}

Set personName to null if it is the message author's own birthday.
Set personName to the relationship or name (e.g. "wife", "husband", "son", "daughter", "Mom", "Dad") if it is someone else's birthday.

If the message is NOT about a birthday, or you cannot determine a date, respond with:
{"isBirthday": false}

Rules:
- Extract if a specific date is stated ("March 15") OR can be resolved from context ("tomorrow", "Thursday", "this weekend")
- "my birthday is March 15" -> personName: null, month: 3, day: 15
- "my wife's birthday is June 1st" -> personName: "wife", month: 6, day: 1
- "my birthday is Thursday" -> resolve Thursday relative to the message date
- "my birthday is tomorrow" -> resolve to the day after the message date
- "I turn 30 on April 2nd" -> personName: null, month: 4, day: 2
- "my son turns 5 next Friday" -> resolve next Friday from the message date, personName: "son"
- "wife's bday is the 15th" -> personName: "wife", use the current or next month for "the 15th"
- "born on the 4th of July" -> personName: null, month: 7, day: 4
- "happy birthday @someone" -> isBirthday: true, personName: "@mentioned", use the MESSAGE DATE as the birthday (someone is being wished happy birthday TODAY). Always set personName to "@mentioned" when the birthday belongs to a mentioned/tagged user, not the message author.
- "happy bday @someone" -> same as above, personName: "@mentioned", use the message date
- "I love birthdays" -> isBirthday: false
- "planning a birthday party" -> isBirthday: false (no specific person's date)
- "what should I get for a birthday gift" -> isBirthday: false
- Month must be 1-12, day must be valid for that month`;

export class BirthdayEngine {
  constructor(
    private ollamaAccessor: OllamaAccessor,
    private birthdayAccessor: BirthdayAccessor,
  ) {}

  containsBirthdayKeyword(text: string): boolean {
    return BIRTHDAY_KEYWORD_REGEX.test(text);
  }

  async analyzeAndStore(request: AnalyzeBirthdayRequest): Promise<AnalyzeBirthdayResponse> {
    logger.debug(`Birthday: analyzing message ${request.messageId} from user ${request.userId}`);
    logger.debug(`Birthday: message content: "${request.messageContent.slice(0, 200)}"`);

    let parsed: OllamaBirthdayResult;
    try {
      const dateStr = request.messageDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const userMessage = `Message posted on ${dateStr}:\n\n${request.messageContent}`;

      const response = await this.ollamaAccessor.chat([
        { role: "system", content: ANALYZE_PROMPT },
        { role: "user", content: userMessage },
      ]);

      logger.debug(`Birthday: Ollama raw response: "${response.slice(0, 300)}"`);
      const cleaned = response.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
      logger.debug(`Birthday: parsed result: isBirthday=${parsed.isBirthday}, person=${parsed.personName ?? "self"}, date=${parsed.month}/${parsed.day}`);
    } catch (error) {
      logger.error("Failed to parse birthday from message:", error);
      return { stored: false, reason: "parse_error" };
    }

    if (!parsed.isBirthday) {
      logger.debug(`Birthday: not a birthday mention (message ${request.messageId})`);
      return { stored: false, reason: "not_birthday" };
    }

    if (!this.isValidDate(parsed.month, parsed.day)) {
      logger.warn(`Birthday: invalid date ${parsed.month}/${parsed.day} from message ${request.messageId}`);
      return { stored: false, reason: "parse_error" };
    }

    let targetUserId = request.userId;
    let personName = parsed.personName ?? null;

    if (personName === "@mentioned" && request.mentionedUserIds.length > 0) {
      targetUserId = request.mentionedUserIds[0];
      personName = null;
      logger.debug(`Birthday: attributed to mentioned user ${targetUserId}`);
    } else if (personName === "@mentioned") {
      personName = null;
    }

    const result = await this.birthdayAccessor.upsert(
      request.guildId,
      targetUserId,
      personName,
      parsed.month,
      parsed.day,
      "detected",
    );

    logger.info(
      `Birthday ${result}: ${personName ?? "self"} (${parsed.month}/${parsed.day}) for user ${targetUserId}`,
    );
    return { stored: true, reason: "stored" };
  }

  async addBirthday(request: AddBirthdayRequest): Promise<AddBirthdayResponse> {
    if (!this.isValidDate(request.month, request.day)) {
      return { success: false, reason: "invalid_date" };
    }

    const result = await this.birthdayAccessor.upsert(
      request.guildId,
      request.userId,
      request.personName,
      request.month,
      request.day,
      "manual",
    );

    return { success: true, reason: result };
  }

  async removeBirthday(request: RemoveBirthdayRequest): Promise<RemoveBirthdayResponse> {
    const removed = await this.birthdayAccessor.remove(
      request.guildId,
      request.userId,
      request.personName,
    );
    return { removed };
  }

  async removeAllForUser(guildId: string, userId: string): Promise<number> {
    return this.birthdayAccessor.removeAllForUser(guildId, userId);
  }

  async listBirthdays(guildId: string, userId: string): Promise<BirthdayEntry[]> {
    return this.birthdayAccessor.listForUser(guildId, userId);
  }

  async getTodaysBirthdays(guildId: string, month: number, day: number): Promise<BirthdayEntry[]> {
    return this.birthdayAccessor.findByDate(guildId, month, day);
  }

  private isValidDate(month: number, day: number): boolean {
    if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
    if (month < 1 || month > 12 || day < 1) return false;
    return day <= DAYS_IN_MONTH[month];
  }
}
