import type { ReminderAccessor } from "../accessors/reminder-accessor.js";
import type {
  CreateReminderRequest,
  CreateReminderResponse,
  CancelReminderResponse,
  ReminderEntry,
  DueReminder,
} from "../types/reminder-contracts.js";

const MAX_REMINDERS_PER_USER = 25;
const MAX_FUTURE_MS = 365 * 24 * 60 * 60 * 1000;
const MIN_FUTURE_MS = 60_000;
const MAX_MESSAGE_LENGTH = 1000;

export class ReminderEngine {
  constructor(private reminderAccessor: ReminderAccessor) {}

  async createReminder(request: CreateReminderRequest): Promise<CreateReminderResponse> {
    const now = Date.now();

    if (!request.message || request.message.trim().length === 0) {
      return { success: false, reason: "empty_message" };
    }

    if (request.message.length > MAX_MESSAGE_LENGTH) {
      return { success: false, reason: "message_too_long" };
    }

    if (request.deliverAt <= now) {
      return { success: false, reason: "past_date" };
    }

    if (request.deliverAt - now < MIN_FUTURE_MS) {
      return { success: false, reason: "too_soon" };
    }

    if (request.deliverAt - now > MAX_FUTURE_MS) {
      return { success: false, reason: "too_far" };
    }

    const pendingCount = await this.reminderAccessor.countPendingForUser(request.userId);
    if (pendingCount >= MAX_REMINDERS_PER_USER) {
      return { success: false, reason: "too_many" };
    }

    const reminderId = await this.reminderAccessor.create(
      request.guildId,
      request.channelId,
      request.userId,
      request.message.trim(),
      request.deliverAt,
      request.isPublic,
      now,
    );

    return { success: true, reason: "created", reminderId, deliverAt: request.deliverAt };
  }

  async cancelReminder(reminderId: number, userId: string): Promise<CancelReminderResponse> {
    const reminder = await this.reminderAccessor.getById(reminderId);

    if (!reminder) {
      return { success: false, reason: "not_found" };
    }

    if (reminder.userId !== userId) {
      return { success: false, reason: "not_owner" };
    }

    if (reminder.status !== "pending") {
      return { success: false, reason: "already_delivered" };
    }

    await this.reminderAccessor.cancel(reminderId);
    return { success: true, reason: "cancelled" };
  }

  async listReminders(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ reminders: ReminderEntry[]; total: number; page: number; pageSize: number }> {
    const total = await this.reminderAccessor.countPendingForUser(userId);
    const offset = (page - 1) * pageSize;
    const entries = await this.reminderAccessor.listPendingForUser(userId, pageSize, offset);
    return { reminders: entries, total, page, pageSize };
  }

  async getDueReminders(): Promise<DueReminder[]> {
    return this.reminderAccessor.getDueReminders(Date.now());
  }

  async markDelivered(reminderId: number): Promise<void> {
    await this.reminderAccessor.markDelivered(reminderId, Date.now());
  }
}
