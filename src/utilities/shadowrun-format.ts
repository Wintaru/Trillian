import { EmbedBuilder } from "discord.js";
import type { DiceRollResult, DiceRollDisplayResult } from "../types/shadowrun-contracts.js";
import type { CharacterRow } from "../accessors/character-accessor.js";
import type { CampaignRow, CampaignPlayerRow } from "../accessors/campaign-accessor.js";
import { DiceEngine } from "../engines/dice-engine.js";

export interface ParsedNarrativeResponse {
  narrative: string;
  rollRequests: { characterName: string; pool: number; limit?: number; description: string }[];
}

export function parseNarrativeResponse(response: string): ParsedNarrativeResponse {
  const rollPattern = /\[ROLL:\s*(\S+)\s+(\d+)d6\s*\(([^)]+)\)\s*(?:limit\s+(\d+))?\s*-\s*([^\]]+)\]/g;
  const rollRequests: ParsedNarrativeResponse["rollRequests"] = [];
  let match;

  while ((match = rollPattern.exec(response)) !== null) {
    rollRequests.push({
      characterName: match[1],
      pool: parseInt(match[2], 10),
      limit: match[4] ? parseInt(match[4], 10) : undefined,
      description: match[5].trim(),
    });
  }

  const narrative = response.replace(rollPattern, "").trim();
  return { narrative, rollRequests };
}

export function formatDiceRoll(displayResult: DiceRollDisplayResult): string {
  const { characterName, description, result } = displayResult;
  const diceStr = result.results
    .map((d) => (d >= 5 ? `**${d}**` : `${d}`))
    .join(" | ");

  let line = `**${characterName}** rolls ${description} (${result.pool}d6`;
  if (result.limit !== undefined) {
    line += `, limit ${result.limit}`;
  }
  line += `)\n[ ${diceStr} ]`;
  line += `\nHits: **${result.effectiveHits}**`;

  if (result.isCriticalGlitch) {
    line += " | **CRITICAL GLITCH!**";
  } else if (result.isGlitch) {
    line += " | **Glitch!**";
  }

  if (result.edgeUsed) {
    line += ` | Edge: ${result.edgeUsed.replace(/_/g, " ")}`;
  }

  return line;
}

export function formatCharacterSheet(character: CharacterRow): EmbedBuilder {
  const skills = JSON.parse(character.skills) as { name: string; rating: number; specialization?: string }[];
  const qualities = JSON.parse(character.qualities) as { name: string; type: string }[];
  const spells = JSON.parse(character.spells) as { name: string }[];
  const gear = JSON.parse(character.gear) as { name: string; category?: string }[];
  const contacts = JSON.parse(character.contacts) as { name: string; connection: number; loyalty: number }[];
  const cyberware = JSON.parse(character.cyberware) as { name: string; essenceCost: number }[];

  const physLimit = DiceEngine.physicalLimit(character.strength, character.body, character.reaction);
  const mentLimit = DiceEngine.mentalLimit(character.logic, character.intuition, character.willpower);
  const socLimit = DiceEngine.socialLimit(character.charisma, character.willpower, parseFloat(character.essence));
  const init = DiceEngine.initiative(character.reaction, character.intuition);

  const embed = new EmbedBuilder()
    .setTitle(`${character.name} — ${character.metatype}${character.archetype ? ` (${character.archetype})` : ""}`)
    .setColor(0x00ff41);

  embed.addFields(
    {
      name: "Attributes",
      value: [
        `BOD ${character.body} | AGI ${character.agility} | REA ${character.reaction} | STR ${character.strength}`,
        `WIL ${character.willpower} | LOG ${character.logic} | INT ${character.intuition} | CHA ${character.charisma}`,
        `Edge ${character.edge} | Essence ${character.essence}${character.magic ? ` | Magic ${character.magic}` : ""}${character.resonance ? ` | Resonance ${character.resonance}` : ""}`,
      ].join("\n"),
      inline: false,
    },
    {
      name: "Derived Stats",
      value: `Physical Limit ${physLimit} | Mental Limit ${mentLimit} | Social Limit ${socLimit}\nInitiative ${init}+1d6 | Physical CM ${character.physicalCmCurrent}/${character.physicalCmMax} | Stun CM ${character.stunCmCurrent}/${character.stunCmMax}`,
      inline: false,
    },
  );

  if (skills.length > 0) {
    const skillText = skills
      .slice(0, 15)
      .map((s) => `${s.name} ${s.rating}${s.specialization ? ` (${s.specialization})` : ""}`)
      .join(", ");
    embed.addFields({ name: "Skills", value: skillText || "None", inline: false });
  }

  if (qualities.length > 0) {
    const qualText = qualities.map((q) => `${q.name} (${q.type})`).join(", ");
    embed.addFields({ name: "Qualities", value: qualText, inline: false });
  }

  if (spells.length > 0) {
    embed.addFields({ name: "Spells", value: spells.map((s) => s.name).join(", "), inline: false });
  }

  if (cyberware.length > 0) {
    embed.addFields({ name: "Cyberware", value: cyberware.map((c) => `${c.name} (${c.essenceCost} ESS)`).join(", "), inline: false });
  }

  if (gear.length > 0) {
    const gearText = gear.slice(0, 15).map((g) => g.name).join(", ");
    embed.addFields({ name: "Gear", value: gearText, inline: false });
  }

  if (contacts.length > 0) {
    const contactText = contacts.map((c) => `${c.name} (C${c.connection}/L${c.loyalty})`).join(", ");
    embed.addFields({ name: "Contacts", value: contactText, inline: false });
  }

  embed.addFields({
    name: "Economy",
    value: `Nuyen: ${character.nuyen.toLocaleString()} | Karma: ${character.karma} | Lifestyle: ${character.lifestyle ?? "Street"}`,
    inline: false,
  });

  return embed;
}

export function formatCharacterSummaryEmbed(character: CharacterRow): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`${character.name} — ${character.metatype}${character.archetype ? ` (${character.archetype})` : ""}`)
    .setColor(0x00ff41)
    .addFields(
      {
        name: "Attributes",
        value: `BOD ${character.body} | AGI ${character.agility} | REA ${character.reaction} | STR ${character.strength} | WIL ${character.willpower} | LOG ${character.logic} | INT ${character.intuition} | CHA ${character.charisma}`,
        inline: false,
      },
      {
        name: "Special",
        value: `Edge ${character.edge} | Essence ${character.essence}${character.magic ? ` | Magic ${character.magic}` : ""}`,
        inline: false,
      },
    );
}

export function formatCampaignStatus(
  campaign: CampaignRow,
  players: CampaignPlayerRow[],
  characterNames: Map<string, string>,
): EmbedBuilder {
  const playerList = players
    .map((p) => {
      const charName = characterNames.get(p.userId);
      return charName ? `<@${p.userId}> — ${charName}` : `<@${p.userId}> — No character yet`;
    })
    .join("\n");

  return new EmbedBuilder()
    .setTitle(campaign.name)
    .setColor(0xff4500)
    .setDescription(campaign.setting.slice(0, 400) + (campaign.setting.length > 400 ? "..." : ""))
    .addFields(
      { name: "Status", value: campaign.status, inline: true },
      { name: "Objective", value: campaign.currentObjective ?? "Not set", inline: true },
      { name: "Location", value: campaign.currentLocation ?? "Unknown", inline: true },
      { name: `Players (${players.length})`, value: playerList || "None", inline: false },
    );
}
