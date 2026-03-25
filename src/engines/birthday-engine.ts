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

const BIRTHDAY_KEYWORD_REGEX = /birthday|bday|b-day|born on/i;

const DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const ANALYZE_PROMPT = `You are analyzing a Discord message to determine if the author is TELLING you when a specific birthday is.

You will be told the date the message was posted. Use this to resolve relative dates like "tomorrow", "Thursday", "next week", etc.

Respond with ONLY valid JSON (no markdown fences).

If the message explicitly states when someone's birthday IS (with a date, day of week, or relative time reference):
{
  "isBirthday": true,
  "personName": "wife" or "Mom" or "son Jake" or null,
  "month": 3,
  "day": 15
}

Set personName to null if it is the message author's own birthday.
Set personName to the relationship or name if it is someone else's birthday.

If the message does NOT explicitly state when a birthday is, respond with:
{"isBirthday": false}

IMPORTANT — only return isBirthday: true when the person is DECLARING or STATING when a birthday is. The message must directly say something like "my birthday is [date]" or "her birthday is [date]".

Return isBirthday: FALSE for all of these:
- Wishing someone happy birthday ("happy birthday!", "happy bday @someone")
- Talking ABOUT a birthday event ("went to a birthday party", "got invited to a birthday")
- Mentioning spending money or doing things on their birthday ("spent 2k on my birthday")
- Discussing birthday plans without stating the date ("planning a birthday party")
- Talking about birthday gifts ("what should I get for a birthday gift")
- Mentioning a birthday exists without a date ("my daughter turns 21 in May" — no day)
- Referencing a historical figure's birthday
- Going somewhere for a birthday ("going to KC for her birthday weekend")
- Celebrating a birthday without stating the date ("celebrating a birthday today")

Return isBirthday: TRUE for these:
- "my birthday is March 15" -> personName: null, month: 3, day: 15
- "my wife's birthday is June 1st" -> personName: "wife", month: 6, day: 1
- "my birthday is Thursday" -> resolve Thursday relative to the message date
- "my husband's birthday is tomorrow" -> resolve to the day after the message date
- "I turn 30 on April 2nd" -> personName: null, month: 4, day: 2
- "born on the 4th of July" -> personName: null, month: 7, day: 4
- "my bday is st paddys day" -> personName: null, month: 3, day: 17

When in doubt, return isBirthday: false. It is much better to miss a birthday than to store a wrong one.
Month must be 1-12, day must be valid for that month.`;

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

    const personName = parsed.personName ?? null;

    const result = await this.birthdayAccessor.upsert(
      request.guildId,
      request.userId,
      personName,
      parsed.month,
      parsed.day,
      "detected",
    );

    logger.info(
      `Birthday ${result}: ${personName ?? "self"} (${parsed.month}/${parsed.day}) for user ${request.userId}`,
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
