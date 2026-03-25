import type { BirthdayAccessor } from "../accessors/birthday-accessor.js";
import type {
  AddBirthdayRequest,
  AddBirthdayResponse,
  RemoveBirthdayRequest,
  RemoveBirthdayResponse,
  BirthdayEntry,
} from "../types/birthday-contracts.js";

const DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export class BirthdayEngine {
  constructor(private birthdayAccessor: BirthdayAccessor) {}

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

  async getAllBirthdays(guildId: string): Promise<BirthdayEntry[]> {
    return this.birthdayAccessor.findAllForGuild(guildId);
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
