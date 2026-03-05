import type { XpAccessor } from "../accessors/xp-accessor.js";
import type {
  AwardXpRequest,
  AwardXpResponse,
  UserStatsRequest,
  UserStatsResponse,
  LeaderboardRequest,
  LeaderboardResponse,
  AdminXpSetRequest,
  AdminXpAddRequest,
  AdminXpResetRequest,
  AdminXpResponse,
} from "../types/xp-contracts.js";

export class XpEngine {
  constructor(
    private xpAccessor: XpAccessor,
    private xpMin: number,
    private xpMax: number,
    private cooldownSeconds: number,
  ) {}

  static xpForLevel(level: number): number {
    if (level <= 0) return 0;
    let total = 0;
    for (let n = 1; n <= level; n++) {
      total += 5 * n * n + 50 * n + 100;
    }
    return total;
  }

  static levelFromXp(xp: number): number {
    let level = 0;
    while (XpEngine.xpForLevel(level + 1) <= xp) {
      level++;
    }
    return level;
  }

  private rollXp(): number {
    return Math.floor(Math.random() * (this.xpMax - this.xpMin + 1)) + this.xpMin;
  }

  private isCooldownElapsed(lastXpAt: number | null, now: number): boolean {
    if (lastXpAt === null) return true;
    const elapsedSeconds = (now - lastXpAt) / 1000;
    return elapsedSeconds >= this.cooldownSeconds;
  }

  async awardXp(request: AwardXpRequest): Promise<AwardXpResponse> {
    const now = Date.now();
    const existing = await this.xpAccessor.getUserXp(request.userId, request.guildId);

    if (existing && !this.isCooldownElapsed(existing.lastXpAt, now)) {
      return {
        awarded: false,
        xpGained: 0,
        previousLevel: existing.level,
        currentLevel: existing.level,
        leveledUp: false,
        rankName: null,
        newRoleIds: [],
      };
    }

    const previousLevel = existing?.level ?? 0;
    const previousXp = existing?.xp ?? 0;
    const xpGained = this.rollXp();
    const newTotalXp = previousXp + xpGained;
    const newLevel = XpEngine.levelFromXp(newTotalXp);

    await this.xpAccessor.upsertXp(request.userId, request.guildId, xpGained, newLevel, now);

    const leveledUp = newLevel > previousLevel;
    const rankName = leveledUp ? await this.xpAccessor.getRankName(newLevel) : null;
    const newRoleIds = leveledUp
      ? (await this.xpAccessor.getRoleRewardsAtLevel(request.guildId, newLevel)).map(
          (r) => r.roleId,
        )
      : [];

    return {
      awarded: true,
      xpGained,
      previousLevel,
      currentLevel: newLevel,
      leveledUp,
      rankName,
      newRoleIds,
    };
  }

  async getUserStats(request: UserStatsRequest): Promise<UserStatsResponse> {
    const record = await this.xpAccessor.getUserXp(request.userId, request.guildId);

    if (!record) {
      return {
        userId: request.userId,
        xp: 0,
        level: 0,
        rankName: null,
        xpForCurrentLevel: 0,
        xpForNextLevel: XpEngine.xpForLevel(1),
        progressXp: 0,
        requiredXp: XpEngine.xpForLevel(1),
        found: false,
      };
    }

    const rankName = await this.xpAccessor.getRankName(record.level);
    const xpForCurrent = XpEngine.xpForLevel(record.level);
    const xpForNext = XpEngine.xpForLevel(record.level + 1);

    return {
      userId: request.userId,
      xp: record.xp,
      level: record.level,
      rankName,
      xpForCurrentLevel: xpForCurrent,
      xpForNextLevel: xpForNext,
      progressXp: record.xp - xpForCurrent,
      requiredXp: xpForNext - xpForCurrent,
      found: true,
    };
  }

  async getLeaderboard(request: LeaderboardRequest): Promise<LeaderboardResponse> {
    const offset = (request.page - 1) * request.pageSize;
    const totalUsers = await this.xpAccessor.countGuildUsers(request.guildId);
    const totalPages = Math.max(1, Math.ceil(totalUsers / request.pageSize));
    const rows = await this.xpAccessor.getLeaderboard(request.guildId, offset, request.pageSize);

    const entries = await Promise.all(
      rows.map(async (row, i) => ({
        userId: row.userId,
        xp: row.xp,
        level: row.level,
        rankName: await this.xpAccessor.getRankName(row.level),
        position: offset + i + 1,
      })),
    );

    return { entries, page: request.page, totalPages, totalUsers };
  }

  async setXp(request: AdminXpSetRequest): Promise<AdminXpResponse> {
    const existing = await this.xpAccessor.getUserXp(request.userId, request.guildId);
    const previousXp = existing?.xp ?? 0;
    const previousLevel = existing?.level ?? 0;
    const newLevel = XpEngine.levelFromXp(request.xp);
    await this.xpAccessor.setUserXp(request.userId, request.guildId, request.xp, newLevel);
    return {
      userId: request.userId,
      previousXp,
      previousLevel,
      currentXp: request.xp,
      currentLevel: newLevel,
    };
  }

  async addXp(request: AdminXpAddRequest): Promise<AdminXpResponse> {
    const existing = await this.xpAccessor.getUserXp(request.userId, request.guildId);
    const previousXp = existing?.xp ?? 0;
    const previousLevel = existing?.level ?? 0;
    const newTotalXp = previousXp + request.xp;
    const newLevel = XpEngine.levelFromXp(newTotalXp);
    await this.xpAccessor.setUserXp(request.userId, request.guildId, newTotalXp, newLevel);
    return {
      userId: request.userId,
      previousXp,
      previousLevel,
      currentXp: newTotalXp,
      currentLevel: newLevel,
    };
  }

  async resetXp(request: AdminXpResetRequest): Promise<AdminXpResponse> {
    const existing = await this.xpAccessor.getUserXp(request.userId, request.guildId);
    const previousXp = existing?.xp ?? 0;
    const previousLevel = existing?.level ?? 0;
    await this.xpAccessor.resetUserXp(request.userId, request.guildId);
    return {
      userId: request.userId,
      previousXp,
      previousLevel,
      currentXp: 0,
      currentLevel: 0,
    };
  }
}
