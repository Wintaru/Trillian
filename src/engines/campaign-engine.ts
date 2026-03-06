import type { CampaignAccessor, CampaignRow } from "../accessors/campaign-accessor.js";
import type { CharacterAccessor, CharacterRow } from "../accessors/character-accessor.js";
import type { OllamaAccessor, OllamaChatMessage } from "../accessors/ollama-accessor.js";
import { DiceEngine } from "./dice-engine.js";
import type {
  StartCampaignRequest,
  StartCampaignResponse,
  StopCampaignRequest,
  StopCampaignResponse,
  PauseCampaignRequest,
  PauseCampaignResponse,
  ResumeCampaignRequest,
  ResumeCampaignResponse,
  AddPlayerRequest,
  RemovePlayerRequest,
  PlayerManagementResponse,
  AdvanceNarrativeRequest,
  AdvanceNarrativeResponse,
  DiceRollDisplayResult,
  RecapResponse,
  CampaignHistoryEntry,
} from "../types/shadowrun-contracts.js";
import {
  GM_SYSTEM_PROMPT_PREFIX,
  CONDENSED_RULES_PROMPT,
  CAMPAIGN_GENERATION_PROMPT,
  RECAP_PROMPT,
  PLAYER_JOIN_PROMPT,
  PLAYER_LEAVE_PROMPT,
} from "../utilities/shadowrun-reference.js";
import { parseNarrativeResponse, formatDiceRoll } from "../utilities/shadowrun-format.js";
import * as logger from "../utilities/logger.js";

const NARRATIVE_LOG_CONTEXT_COUNT = 10;
const FALLBACK_NARRATIVE = "The shadows grow quiet for a moment... The GM seems to be having technical difficulties. Try again, chummer.";

export class CampaignEngine {
  constructor(
    private campaignAccessor: CampaignAccessor,
    private characterAccessor: CharacterAccessor,
    private ollamaAccessor: OllamaAccessor,
    private diceEngine: DiceEngine,
  ) {}

  async startCampaign(request: StartCampaignRequest): Promise<StartCampaignResponse> {
    const existing = await this.campaignAccessor.getActiveCampaignForGuild(request.guildId);
    if (existing) {
      throw new Error("There is already an active campaign in this guild. Stop it first with `/campaign stop`.");
    }

    const paused = await this.campaignAccessor.getPausedCampaignForChannel(request.guildId, request.channelId);
    if (paused) {
      throw new Error("There is a paused campaign in this channel. Resume it with `/campaign resume` or stop it first.");
    }

    const playerCount = request.playerUserIds.length;
    const premiseClause = request.premise
      ? `Base the campaign on this concept: ${request.premise}`
      : "Create an original corporate espionage / shadowrun scenario in the Seattle Metroplex.";

    const messages: OllamaChatMessage[] = [
      {
        role: "system",
        content: `${CAMPAIGN_GENERATION_PROMPT}\n\n${premiseClause}\n\nThe campaign is for ${playerCount || "a group of"} runner${playerCount === 1 ? "" : "s"}.`,
      },
      { role: "user", content: "Generate the campaign now." },
    ];

    const raw = await this.ollamaAccessor.chat(messages);
    const parsed = this.parseCampaignGeneration(raw);
    const now = Date.now();

    const { id } = await this.campaignAccessor.createCampaign(
      request.guildId,
      request.channelId,
      request.gmUserId,
      parsed.name,
      parsed.setting,
      now,
    );

    await this.campaignAccessor.updateCampaignState(id, {
      currentObjective: parsed.objective,
      currentLocation: parsed.location,
    });

    for (const userId of request.playerUserIds) {
      await this.campaignAccessor.addPlayer(id, userId, now);
    }

    await this.campaignAccessor.addNarrativeEntry(id, "scene", parsed.opening, now);

    return {
      campaignId: id,
      name: parsed.name,
      setting: parsed.setting,
      opening: parsed.opening,
      objective: parsed.objective,
      location: parsed.location,
    };
  }

  async stopCampaign(request: StopCampaignRequest): Promise<StopCampaignResponse> {
    const campaign = await this.campaignAccessor.getCampaign(request.campaignId);
    if (!campaign) return { success: false, reason: "not_found" };
    if (campaign.status === "completed") return { success: false, reason: "already_stopped" };
    if (campaign.gmUserId !== request.requesterId && !request.isAdmin) {
      return { success: false, reason: "not_authorized" };
    }

    await this.campaignAccessor.updateCampaignStatus(request.campaignId, "completed");
    return { success: true, reason: "stopped" };
  }

  async pauseCampaign(request: PauseCampaignRequest): Promise<PauseCampaignResponse> {
    const campaign = await this.campaignAccessor.getCampaign(request.campaignId);
    if (!campaign) return { success: false, reason: "not_found" };
    if (campaign.status === "paused") return { success: false, reason: "already_paused" };
    if (campaign.status !== "active") return { success: false, reason: "not_active" };
    if (campaign.gmUserId !== request.requesterId && !request.isAdmin) {
      return { success: false, reason: "not_authorized" };
    }

    await this.campaignAccessor.updateCampaignStatus(request.campaignId, "paused");
    return { success: true, reason: "paused" };
  }

  async resumeCampaign(request: ResumeCampaignRequest): Promise<ResumeCampaignResponse> {
    const campaign = await this.campaignAccessor.getCampaign(request.campaignId);
    if (!campaign) return { success: false, reason: "not_found" };
    if (campaign.status !== "paused") return { success: false, reason: "not_paused" };
    if (campaign.gmUserId !== request.requesterId && !request.isAdmin) {
      return { success: false, reason: "not_authorized" };
    }

    await this.campaignAccessor.updateCampaignStatus(request.campaignId, "active");
    return { success: true, reason: "resumed" };
  }

  async addPlayer(request: AddPlayerRequest): Promise<PlayerManagementResponse> {
    const campaign = await this.campaignAccessor.getCampaign(request.campaignId);
    if (!campaign) return { success: false, reason: "Campaign not found." };
    if (campaign.gmUserId !== request.requesterId && !request.isAdmin) {
      return { success: false, reason: "Only the GM or an admin can add players." };
    }

    await this.campaignAccessor.addPlayer(request.campaignId, request.userId, Date.now());
    return { success: true, reason: "Player added." };
  }

  async removePlayer(request: RemovePlayerRequest): Promise<PlayerManagementResponse> {
    const campaign = await this.campaignAccessor.getCampaign(request.campaignId);
    if (!campaign) return { success: false, reason: "Campaign not found." };
    if (campaign.gmUserId !== request.requesterId && !request.isAdmin) {
      return { success: false, reason: "Only the GM or an admin can remove players." };
    }

    await this.campaignAccessor.removePlayer(request.campaignId, request.userId);
    return { success: true, reason: "Player removed." };
  }

  async advanceNarrative(request: AdvanceNarrativeRequest): Promise<AdvanceNarrativeResponse> {
    const campaign = await this.campaignAccessor.getCampaign(request.campaignId);
    if (!campaign) throw new Error("Campaign not found.");
    if (campaign.status !== "active") throw new Error("Campaign is not active.");

    const characters = await this.characterAccessor.getCharactersForCampaign(request.campaignId);
    const recentNarrative = await this.campaignAccessor.getRecentNarrative(
      request.campaignId,
      NARRATIVE_LOG_CONTEXT_COUNT,
    );

    const systemPrompt = this.buildNarrativeSystemPrompt(campaign, characters, recentNarrative);

    const messages: OllamaChatMessage[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const entry of recentNarrative) {
      messages.push({ role: "assistant", content: entry.content });
    }

    if (request.playerMessages.length > 0) {
      const playerContext = request.playerMessages
        .map((m) => `[${m.authorName}]: ${m.content}`)
        .join("\n");
      messages.push({ role: "user", content: playerContext });
    }

    messages.push({
      role: "user",
      content: `[${request.triggerMessage}]\n\nAdvance the narrative based on what the players have discussed and decided to do.`,
    });

    try {
      const raw = await this.ollamaAccessor.chat(messages);
      const parsed = parseNarrativeResponse(raw);
      const now = Date.now();

      const diceRollResults: DiceRollDisplayResult[] = [];
      for (const rollReq of parsed.rollRequests) {
        const rollResult = this.diceEngine.roll(rollReq.pool, rollReq.limit);
        diceRollResults.push({
          characterName: rollReq.characterName,
          description: rollReq.description,
          result: rollResult,
        });

        const character = characters.find((c) => c.name.toLowerCase() === rollReq.characterName.toLowerCase());
        await this.campaignAccessor.saveDiceRoll(
          request.campaignId,
          character?.id ?? null,
          character?.userId ?? request.triggerUserId,
          rollResult.pool,
          rollResult.hits,
          rollResult.ones,
          rollReq.limit ?? null,
          rollResult.isGlitch,
          rollResult.isCriticalGlitch,
          null,
          rollReq.description,
          rollResult.results,
          now,
        );
      }

      await this.campaignAccessor.addNarrativeEntry(request.campaignId, "scene", parsed.narrative, now);

      if (diceRollResults.length > 0) {
        const rollSummary = diceRollResults.map((dr) => formatDiceRoll(dr)).join("\n");
        await this.campaignAccessor.addNarrativeEntry(request.campaignId, "roll_result", rollSummary, now);
      }

      await this.campaignAccessor.updateCampaignState(request.campaignId, {
        lastPingMessageId: undefined,
        lastPingAt: now,
      });

      return {
        narrative: parsed.narrative,
        diceRollResults,
      };
    } catch (error) {
      logger.error("Narrative advancement failed:", error);
      return { narrative: FALLBACK_NARRATIVE, diceRollResults: [] };
    }
  }

  async recapCampaign(campaignId: number): Promise<RecapResponse> {
    const campaign = await this.campaignAccessor.getCampaign(campaignId);
    if (!campaign) throw new Error("Campaign not found.");

    const narrative = await this.campaignAccessor.getAllNarrative(campaignId);
    const narrativeText = narrative.map((e) => `[${e.type}]: ${e.content}`).join("\n\n");

    const messages: OllamaChatMessage[] = [
      {
        role: "system",
        content: `${RECAP_PROMPT}\n\nCampaign: ${campaign.name}\nSetting: ${campaign.setting}\nCurrent Objective: ${campaign.currentObjective ?? "Unknown"}\nCurrent Location: ${campaign.currentLocation ?? "Unknown"}`,
      },
      { role: "user", content: `Here are the campaign events so far:\n\n${narrativeText}\n\nWrite the recap now.` },
    ];

    const recap = await this.ollamaAccessor.chat(messages);
    return { recap, campaignName: campaign.name };
  }

  async generatePlayerJoinLore(campaignName: string, characterName: string, metatype: string, archetype: string | null): Promise<string> {
    try {
      const messages: OllamaChatMessage[] = [
        { role: "system", content: PLAYER_JOIN_PROMPT },
        { role: "user", content: `Campaign: ${campaignName}. New runner: ${characterName}, a ${metatype}${archetype ? ` ${archetype}` : ""}. Narrate their entrance.` },
      ];
      return await this.ollamaAccessor.chat(messages);
    } catch (error) {
      logger.error("Failed to generate join lore:", error);
      return `*A new runner called **${characterName}** steps out of the shadows and joins the team.*`;
    }
  }

  async generatePlayerLeaveLore(campaignName: string, characterName: string | null): Promise<string> {
    try {
      const messages: OllamaChatMessage[] = [
        { role: "system", content: PLAYER_LEAVE_PROMPT },
        { role: "user", content: `Campaign: ${campaignName}. Runner leaving: ${characterName ?? "an unnamed runner"}. Narrate their exit.` },
      ];
      return await this.ollamaAccessor.chat(messages);
    } catch (error) {
      logger.error("Failed to generate leave lore:", error);
      return `*${characterName ?? "A runner"} slips back into the shadows, disappearing as quickly as they came.*`;
    }
  }

  async getCampaignHistory(guildId: string): Promise<CampaignHistoryEntry[]> {
    const campaigns = await this.campaignAccessor.getCampaignHistory(guildId);
    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      setting: c.setting.slice(0, 200),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  private buildNarrativeSystemPrompt(
    campaign: CampaignRow,
    characters: CharacterRow[],
    _recentNarrative: { type: string; content: string }[],
  ): string {
    let prompt = GM_SYSTEM_PROMPT_PREFIX;
    prompt += `\n${CONDENSED_RULES_PROMPT}\n\n`;
    prompt += `CAMPAIGN STATE:\n`;
    prompt += `- Campaign: ${campaign.name}\n`;
    prompt += `- Setting: ${campaign.setting.slice(0, 500)}\n`;
    prompt += `- Current Objective: ${campaign.currentObjective ?? "Not yet established"}\n`;
    prompt += `- Current Location: ${campaign.currentLocation ?? "Unknown"}\n\n`;

    prompt += `PLAYER CHARACTERS:\n`;
    for (const char of characters) {
      if (char.creationStatus !== "complete") continue;
      prompt += `- ${char.name} (${char.metatype}${char.archetype ? `, ${char.archetype}` : ""}): `;
      prompt += `BOD ${char.body} AGI ${char.agility} REA ${char.reaction} STR ${char.strength} `;
      prompt += `WIL ${char.willpower} LOG ${char.logic} INT ${char.intuition} CHA ${char.charisma} `;
      prompt += `Edge ${char.edge} Essence ${char.essence}`;
      if (char.magic) prompt += ` Magic ${char.magic}`;
      prompt += ` | HP: ${char.physicalCmCurrent}/${char.physicalCmMax} Stun: ${char.stunCmCurrent}/${char.stunCmMax}`;
      const skills = JSON.parse(char.skills) as { name: string; rating: number }[];
      if (skills.length > 0) {
        prompt += ` | Key Skills: ${skills.slice(0, 5).map((s) => `${s.name} ${s.rating}`).join(", ")}`;
      }
      prompt += "\n";
    }

    return prompt;
  }

  private parseCampaignGeneration(raw: string): {
    name: string;
    setting: string;
    objective: string;
    location: string;
    opening: string;
  } {
    const sections: Record<string, string> = {};
    const lines = raw.split("\n");
    let currentKey = "";
    let currentValue: string[] = [];

    for (const line of lines) {
      const sectionMatch = line.match(/^(NAME|SETTING|OBJECTIVE|LOCATION|OPENING):\s*(.*)/i);
      if (sectionMatch) {
        if (currentKey) {
          sections[currentKey] = currentValue.join("\n").trim();
        }
        currentKey = sectionMatch[1].toUpperCase();
        currentValue = sectionMatch[2] ? [sectionMatch[2]] : [];
      } else if (currentKey) {
        currentValue.push(line);
      }
    }
    if (currentKey) {
      sections[currentKey] = currentValue.join("\n").trim();
    }

    return {
      name: sections["NAME"] || "Unnamed Run",
      setting: sections["SETTING"] || raw.slice(0, 500),
      objective: sections["OBJECTIVE"] || "Survive.",
      location: sections["LOCATION"] || "Seattle Metroplex",
      opening: sections["OPENING"] || sections["SETTING"] || raw.slice(0, 1000),
    };
  }
}
