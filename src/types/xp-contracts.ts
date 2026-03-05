export interface AwardXpRequest {
  userId: string;
  guildId: string;
  channelId: string;
}

export interface AwardXpResponse {
  awarded: boolean;
  xpGained: number;
  previousLevel: number;
  currentLevel: number;
  leveledUp: boolean;
  rankName: string | null;
  newRoleIds: string[];
}

export interface UserStatsRequest {
  userId: string;
  guildId: string;
}

export interface UserStatsResponse {
  userId: string;
  xp: number;
  level: number;
  rankName: string | null;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progressXp: number;
  requiredXp: number;
  found: boolean;
}

export interface LeaderboardRequest {
  guildId: string;
  page: number;
  pageSize: number;
}

export interface LeaderboardEntry {
  userId: string;
  xp: number;
  level: number;
  rankName: string | null;
  position: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  page: number;
  totalPages: number;
  totalUsers: number;
}

export interface AdminXpSetRequest {
  userId: string;
  guildId: string;
  xp: number;
}

export interface AdminXpAddRequest {
  userId: string;
  guildId: string;
  xp: number;
}

export interface AdminXpResetRequest {
  userId: string;
  guildId: string;
}

export interface AdminXpResponse {
  userId: string;
  previousXp: number;
  previousLevel: number;
  currentXp: number;
  currentLevel: number;
}

export interface RoleReward {
  level: number;
  roleId: string;
}
