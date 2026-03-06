export interface StartCampaignRequest {
  guildId: string;
  channelId: string;
  gmUserId: string;
  playerUserIds: string[];
  premise?: string;
}

export interface StartCampaignResponse {
  campaignId: number;
  name: string;
  setting: string;
  opening: string;
  objective: string;
  location: string;
}

export interface StopCampaignRequest {
  campaignId: number;
  requesterId: string;
  isAdmin: boolean;
}

export interface StopCampaignResponse {
  success: boolean;
  reason: "stopped" | "not_found" | "not_authorized" | "already_stopped";
}

export interface PauseCampaignRequest {
  campaignId: number;
  requesterId: string;
  isAdmin: boolean;
}

export interface PauseCampaignResponse {
  success: boolean;
  reason: "paused" | "not_found" | "not_authorized" | "already_paused" | "not_active";
}

export interface ResumeCampaignRequest {
  campaignId: number;
  requesterId: string;
  isAdmin: boolean;
}

export interface ResumeCampaignResponse {
  success: boolean;
  reason: "resumed" | "not_found" | "not_authorized" | "not_paused";
}

export interface AddPlayerRequest {
  campaignId: number;
  userId: string;
  requesterId: string;
  isAdmin: boolean;
}

export interface RemovePlayerRequest {
  campaignId: number;
  userId: string;
  requesterId: string;
  isAdmin: boolean;
}

export interface PlayerManagementResponse {
  success: boolean;
  reason: string;
}

export interface PlayerMessage {
  authorName: string;
  authorId: string;
  content: string;
  timestamp: number;
}

export interface AdvanceNarrativeRequest {
  campaignId: number;
  playerMessages: PlayerMessage[];
  triggerUserId: string;
  triggerMessage: string;
}

export interface AdvanceNarrativeResponse {
  narrative: string;
  diceRollResults: DiceRollDisplayResult[];
  objectiveUpdate?: string;
  locationUpdate?: string;
}

export interface DiceRollRequest {
  characterName: string;
  pool: number;
  limit?: number;
  description: string;
}

export interface DiceRollResult {
  pool: number;
  results: number[];
  hits: number;
  ones: number;
  limit?: number;
  effectiveHits: number;
  isGlitch: boolean;
  isCriticalGlitch: boolean;
  edgeUsed?: string;
}

export interface DiceRollDisplayResult {
  characterName: string;
  description: string;
  result: DiceRollResult;
}

export type CharacterCreationStep =
  | "metatype"
  | "archetype"
  | "attributes"
  | "skills"
  | "qualities"
  | "magic"
  | "gear"
  | "contacts"
  | "backstory"
  | "review"
  | "complete";

export interface CharacterCreationState {
  characterId: number;
  currentStep: CharacterCreationStep;
  campaignId: number | null;
  userId: string;
}

export interface CharacterSummary {
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
  nuyen: number;
  karma: number;
  physicalCmCurrent: number;
  physicalCmMax: number;
  stunCmCurrent: number;
  stunCmMax: number;
}

export interface MetatypeData {
  name: string;
  attributeLimits: Record<string, { min: number; max: number }>;
  racialAbilities: string[];
  startingEdge: number;
}

export interface CampaignHistoryEntry {
  id: number;
  name: string;
  status: string;
  setting: string;
  createdAt: number;
  updatedAt: number;
}

export interface RecapResponse {
  recap: string;
  campaignName: string;
}
