import { eq, and, desc, sql, count } from "drizzle-orm";
import { db } from "./database.js";
import { userXp, ranks, levelRoleRewards } from "../db/schema.js";
import type { RoleReward } from "../types/xp-contracts.js";

export class XpAccessor {
  async upsertXp(
    userId: string,
    guildId: string,
    xpToAdd: number,
    newLevel: number,
    now: number,
  ): Promise<{ xp: number; level: number }> {
    const result = await db
      .insert(userXp)
      .values({ userId, guildId, xp: xpToAdd, level: newLevel, lastXpAt: now, createdAt: now })
      .onConflictDoUpdate({
        target: [userXp.userId, userXp.guildId],
        set: {
          xp: sql`${userXp.xp} + ${xpToAdd}`,
          level: newLevel,
          lastXpAt: now,
        },
      })
      .returning({ xp: userXp.xp, level: userXp.level });
    return result[0];
  }

  async getUserXp(
    userId: string,
    guildId: string,
  ): Promise<{ xp: number; level: number; lastXpAt: number | null } | null> {
    const rows = await db
      .select({ xp: userXp.xp, level: userXp.level, lastXpAt: userXp.lastXpAt })
      .from(userXp)
      .where(and(eq(userXp.userId, userId), eq(userXp.guildId, guildId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async setUserXp(userId: string, guildId: string, xp: number, level: number): Promise<void> {
    const now = Date.now();
    await db
      .insert(userXp)
      .values({ userId, guildId, xp, level, createdAt: now })
      .onConflictDoUpdate({
        target: [userXp.userId, userXp.guildId],
        set: { xp, level },
      });
  }

  async resetUserXp(userId: string, guildId: string): Promise<void> {
    await db
      .update(userXp)
      .set({ xp: 0, level: 0, lastXpAt: null })
      .where(and(eq(userXp.userId, userId), eq(userXp.guildId, guildId)));
  }

  async getLeaderboard(
    guildId: string,
    offset: number,
    limit: number,
  ): Promise<{ userId: string; xp: number; level: number }[]> {
    return db
      .select({ userId: userXp.userId, xp: userXp.xp, level: userXp.level })
      .from(userXp)
      .where(eq(userXp.guildId, guildId))
      .orderBy(desc(userXp.xp))
      .limit(limit)
      .offset(offset);
  }

  async countGuildUsers(guildId: string): Promise<number> {
    const result = await db
      .select({ total: count() })
      .from(userXp)
      .where(eq(userXp.guildId, guildId));
    return result[0]?.total ?? 0;
  }

  async getRankName(level: number): Promise<string | null> {
    const rows = await db
      .select({ name: ranks.name })
      .from(ranks)
      .where(sql`${ranks.level} <= ${level}`)
      .orderBy(desc(ranks.level))
      .limit(1);
    return rows[0]?.name ?? null;
  }

  async getRoleRewardsAtLevel(guildId: string, level: number): Promise<RoleReward[]> {
    return db
      .select({ level: levelRoleRewards.level, roleId: levelRoleRewards.roleId })
      .from(levelRoleRewards)
      .where(and(eq(levelRoleRewards.guildId, guildId), eq(levelRoleRewards.level, level)));
  }

  async seedRanks(rankData: { level: number; name: string }[]): Promise<void> {
    for (const rank of rankData) {
      await db.insert(ranks).values(rank).onConflictDoNothing();
    }
  }
}
