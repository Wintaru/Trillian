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
