import { eq, and, desc } from "drizzle-orm";
import { db } from "./database.js";
import { campaigns, campaignPlayers, campaignNarrativeLog, diceRolls } from "../db/schema.js";

export interface CampaignRow {
  id: number;
  guildId: string;
  channelId: string;
  gmUserId: string;
  name: string;
  status: string;
  setting: string;
  currentObjective: string | null;
  currentLocation: string | null;
  lastPingMessageId: string | null;
  lastPingAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CampaignPlayerRow {
  campaignId: number;
  userId: string;
  characterId: number | null;
  joinedAt: number;
  status: string;
}

export interface NarrativeLogRow {
  id: number;
  campaignId: number;
  type: string;
  content: string;
  createdAt: number;
}

export class CampaignAccessor {
  async createCampaign(
    guildId: string,
    channelId: string,
    gmUserId: string,
    name: string,
    setting: string,
    now: number,
  ): Promise<{ id: number }> {
    const result = await db
      .insert(campaigns)
      .values({
        guildId,
        channelId,
        gmUserId,
        name,
        setting,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: campaigns.id });
    return result[0];
  }

  async getCampaign(campaignId: number): Promise<CampaignRow | null> {
    const rows = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
    return (rows[0] as CampaignRow | undefined) ?? null;
  }

  async getActiveCampaignForChannel(guildId: string, channelId: string): Promise<CampaignRow | null> {
    const rows = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.guildId, guildId),
          eq(campaigns.channelId, channelId),
          eq(campaigns.status, "active"),
        ),
      )
      .limit(1);
    return (rows[0] as CampaignRow | undefined) ?? null;
  }

  async getActiveCampaignForGuild(guildId: string): Promise<CampaignRow | null> {
    const rows = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.guildId, guildId),
          eq(campaigns.status, "active"),
        ),
      )
      .limit(1);
    return (rows[0] as CampaignRow | undefined) ?? null;
  }

  async getPausedCampaignForChannel(guildId: string, channelId: string): Promise<CampaignRow | null> {
    const rows = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.guildId, guildId),
          eq(campaigns.channelId, channelId),
          eq(campaigns.status, "paused"),
        ),
      )
      .limit(1);
    return (rows[0] as CampaignRow | undefined) ?? null;
  }

  async updateCampaignStatus(campaignId: number, status: string): Promise<void> {
    await db
      .update(campaigns)
      .set({ status, updatedAt: Date.now() })
      .where(eq(campaigns.id, campaignId));
  }

  async updateCampaignState(
    campaignId: number,
    updates: {
      currentObjective?: string;
      currentLocation?: string;
      lastPingMessageId?: string;
      lastPingAt?: number;
      name?: string;
      setting?: string;
    },
  ): Promise<void> {
    await db
      .update(campaigns)
      .set({ ...updates, updatedAt: Date.now() })
      .where(eq(campaigns.id, campaignId));
  }

  async addPlayer(campaignId: number, userId: string, now: number): Promise<void> {
    await db
      .insert(campaignPlayers)
      .values({ campaignId, userId, joinedAt: now })
      .onConflictDoUpdate({
        target: [campaignPlayers.campaignId, campaignPlayers.userId],
        set: { status: "active", joinedAt: now },
      });
  }

  async removePlayer(campaignId: number, userId: string): Promise<void> {
    await db
      .update(campaignPlayers)
      .set({ status: "removed" })
      .where(
        and(
          eq(campaignPlayers.campaignId, campaignId),
          eq(campaignPlayers.userId, userId),
        ),
      );
  }

  async getPlayers(campaignId: number): Promise<CampaignPlayerRow[]> {
    return db
      .select()
      .from(campaignPlayers)
      .where(
        and(
          eq(campaignPlayers.campaignId, campaignId),
          eq(campaignPlayers.status, "active"),
        ),
      ) as Promise<CampaignPlayerRow[]>;
  }

  async linkCharacterToPlayer(campaignId: number, userId: string, characterId: number): Promise<void> {
    await db
      .update(campaignPlayers)
      .set({ characterId })
      .where(
        and(
          eq(campaignPlayers.campaignId, campaignId),
          eq(campaignPlayers.userId, userId),
        ),
      );
  }

  async addNarrativeEntry(campaignId: number, type: string, content: string, now: number): Promise<void> {
    await db.insert(campaignNarrativeLog).values({ campaignId, type, content, createdAt: now });
  }

  async getRecentNarrative(campaignId: number, limit: number): Promise<NarrativeLogRow[]> {
    const rows = await db
      .select()
      .from(campaignNarrativeLog)
      .where(eq(campaignNarrativeLog.campaignId, campaignId))
      .orderBy(desc(campaignNarrativeLog.id))
      .limit(limit);
    return (rows as NarrativeLogRow[]).reverse();
  }

  async getAllNarrative(campaignId: number): Promise<NarrativeLogRow[]> {
    return db
      .select()
      .from(campaignNarrativeLog)
      .where(eq(campaignNarrativeLog.campaignId, campaignId))
      .orderBy(campaignNarrativeLog.id) as Promise<NarrativeLogRow[]>;
  }

  async saveDiceRoll(
    campaignId: number,
    characterId: number | null,
    userId: string,
    pool: number,
    hits: number,
    ones: number,
    limitValue: number | null,
    isGlitch: boolean,
    isCriticalGlitch: boolean,
    edgeUsed: string | null,
    description: string,
    results: number[],
    now: number,
  ): Promise<void> {
    await db.insert(diceRolls).values({
      campaignId,
      characterId,
      userId,
      pool,
      hits,
      ones,
      limitValue,
      isGlitch: isGlitch ? 1 : 0,
      isCriticalGlitch: isCriticalGlitch ? 1 : 0,
      edgeUsed,
      description,
      results: JSON.stringify(results),
      createdAt: now,
    });
  }

  async getCampaignHistory(guildId: string): Promise<CampaignRow[]> {
    return db
      .select()
      .from(campaigns)
      .where(eq(campaigns.guildId, guildId))
      .orderBy(desc(campaigns.createdAt)) as Promise<CampaignRow[]>;
  }
}
