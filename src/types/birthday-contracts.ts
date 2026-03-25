export interface AnalyzeBirthdayRequest {
  messageContent: string;
  messageId: string;
  userId: string;
  guildId: string;
}

export interface AnalyzeBirthdayResponse {
  stored: boolean;
  reason: "stored" | "not_birthday" | "duplicate" | "parse_error";
}

export interface OllamaBirthdayResult {
  isBirthday: boolean;
  personName: string | null;
  month: number;
  day: number;
}

export interface AddBirthdayRequest {
  guildId: string;
  userId: string;
  personName: string | null;
  month: number;
  day: number;
}

export interface AddBirthdayResponse {
  success: boolean;
  reason: "added" | "updated" | "invalid_date";
}

export interface RemoveBirthdayRequest {
  guildId: string;
  userId: string;
  personName: string | null;
}

export interface RemoveBirthdayResponse {
  removed: boolean;
}

export interface BirthdayEntry {
  id: number;
  userId: string;
  personName: string | null;
  month: number;
  day: number;
  source: string;
}

export interface BackfillProgressReport {
  channelsScanned: number;
  totalChannels: number;
  messagesProcessed: number;
  birthdaysFound: number;
}
