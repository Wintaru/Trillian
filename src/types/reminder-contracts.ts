export interface CreateReminderRequest {
  guildId: string;
  channelId: string;
  userId: string;
  message: string;
  deliverAt: number;
  isPublic: boolean;
}

export interface CreateReminderResponse {
  success: boolean;
  reason: "created" | "past_date" | "too_far" | "too_many" | "too_soon" | "empty_message" | "message_too_long";
  reminderId?: number;
  deliverAt?: number;
}

export interface CancelReminderResponse {
  success: boolean;
  reason: "cancelled" | "not_found" | "not_owner" | "already_delivered";
}

export interface ReminderEntry {
  id: number;
  message: string;
  deliverAt: number;
  isPublic: number;
  channelId: string;
  status: string;
  createdAt: number;
}

export interface DueReminder {
  id: number;
  guildId: string;
  channelId: string;
  userId: string;
  message: string;
  deliverAt: number;
  isPublic: number;
}
