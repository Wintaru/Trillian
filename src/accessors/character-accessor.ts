import { eq, and } from "drizzle-orm";
import { db } from "./database.js";
import { characters } from "../db/schema.js";

export interface CharacterRow {
  id: number;
  userId: string;
  campaignId: number | null;
  name: string;
  metatype: string;
  archetype: string | null;
  body: number;
  agility: number;
  reaction: number;
  strength: number;
  willpower: number;
  logic: number;
  intuition: number;
  charisma: number;
  edge: number;
  essence: string;
  magic: number | null;
  resonance: number | null;
  skills: string;
  qualities: string;
  spells: string;
  gear: string;
  contacts: string;
  cyberware: string;
  nuyen: number;
  karma: number;
  lifestyle: string | null;
  physicalCmMax: number;
  physicalCmCurrent: number;
  stunCmMax: number;
  stunCmCurrent: number;
  creationStatus: string;
  creationStep: string;
  createdAt: number;
  updatedAt: number;
}

export class CharacterAccessor {
  async createCharacter(
    userId: string,
    campaignId: number | null,
    name: string,
    metatype: string,
    now: number,
  ): Promise<{ id: number }> {
    const result = await db
      .insert(characters)
      .values({
        userId,
        campaignId,
        name,
        metatype,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: characters.id });
    return result[0];
  }

  async getCharacter(characterId: number): Promise<CharacterRow | null> {
    const rows = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);
    return (rows[0] as CharacterRow | undefined) ?? null;
  }

  async getCharacterByUserAndCampaign(userId: string, campaignId: number): Promise<CharacterRow | null> {
    const rows = await db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.userId, userId),
          eq(characters.campaignId, campaignId),
        ),
      )
      .limit(1);
    return (rows[0] as CharacterRow | undefined) ?? null;
  }

  async getCharactersForCampaign(campaignId: number): Promise<CharacterRow[]> {
    return db
      .select()
      .from(characters)
      .where(eq(characters.campaignId, campaignId)) as Promise<CharacterRow[]>;
  }

  async updateCharacter(characterId: number, updates: Partial<CharacterRow>): Promise<void> {
    await db
      .update(characters)
      .set({ ...updates, updatedAt: Date.now() })
      .where(eq(characters.id, characterId));
  }

  async setCreationStep(characterId: number, step: string): Promise<void> {
    await db
      .update(characters)
      .set({ creationStep: step, updatedAt: Date.now() })
      .where(eq(characters.id, characterId));
  }

  async markCreationComplete(characterId: number): Promise<void> {
    await db
      .update(characters)
      .set({ creationStatus: "complete", creationStep: "complete", updatedAt: Date.now() })
      .where(eq(characters.id, characterId));
  }

  async getUnassignedCharactersForUser(userId: string): Promise<CharacterRow[]> {
    return db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.userId, userId),
          eq(characters.creationStatus, "complete"),
        ),
      )
      .then((rows) =>
        (rows as CharacterRow[]).filter((r) => r.campaignId === null),
      );
  }

  async assignCharacterToCampaign(characterId: number, campaignId: number): Promise<void> {
    await db
      .update(characters)
      .set({ campaignId, updatedAt: Date.now() })
      .where(eq(characters.id, characterId));
  }

  async getInProgressCharacterForUser(userId: string): Promise<CharacterRow | null> {
    const rows = await db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.userId, userId),
          eq(characters.creationStatus, "in_progress"),
        ),
      )
      .limit(1);
    return (rows[0] as CharacterRow | undefined) ?? null;
  }
}
