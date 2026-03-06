import type { CharacterAccessor, CharacterRow } from "../accessors/character-accessor.js";
import type { OllamaAccessor, OllamaChatMessage } from "../accessors/ollama-accessor.js";
import type { CharacterCreationStep, CharacterCreationState } from "../types/shadowrun-contracts.js";
import { DiceEngine } from "./dice-engine.js";
import {
  METATYPE_DATA,
  ARCHETYPES,
  ARCHETYPE_DESCRIPTIONS,
  ATTRIBUTE_DESCRIPTIONS,
  MAGIC_ARCHETYPES,
  CHARACTER_CREATION,
  SKILL_LIST,
} from "../utilities/shadowrun-reference.js";
import * as logger from "../utilities/logger.js";

const CREATION_SYSTEM_PROMPT = `You are a Shadowrun fixer helping a new runner create their character. Stay in character — you're gruff but helpful, with street slang. Be concise. Present options clearly. Do NOT make mechanical decisions for the player; just guide them.`;

interface StepResult {
  response: string;
  nextStep: CharacterCreationStep | null;
  complete: boolean;
}

export class CharacterCreationEngine {
  constructor(
    private characterAccessor: CharacterAccessor,
    private ollamaAccessor: OllamaAccessor,
  ) {}

  async startCreation(userId: string, campaignId: number | null, characterName: string): Promise<{ characterId: number; prompt: string }> {
    if (campaignId !== null) {
      const existing = await this.characterAccessor.getCharacterByUserAndCampaign(userId, campaignId);
      if (existing && existing.creationStatus === "complete") {
        return { characterId: existing.id, prompt: `You already have a character: **${existing.name}**. They're ready to run.` };
      }
      if (existing) {
        return { characterId: existing.id, prompt: await this.getStepPrompt(existing) };
      }
    }

    const inProgress = await this.characterAccessor.getInProgressCharacterForUser(userId);
    if (inProgress) {
      return { characterId: inProgress.id, prompt: await this.getStepPrompt(inProgress) };
    }

    const now = Date.now();
    const { id } = await this.characterAccessor.createCharacter(userId, campaignId, characterName, "human", now);

    const metatypeList = Object.entries(METATYPE_DATA)
      .map(([key, data]) => `**${data.name}** — ${data.description}\n  _Abilities: ${data.racialAbilities.join(", ")} | Edge: ${data.startingEdge}_`)
      .join("\n\n");

    const prompt = `Alright chummer, let's get you set up. First things first — **what metatype are you?** This determines your physical form, attribute limits, and racial abilities.\n\n${metatypeList}\n\nReply with your choice (human, elf, dwarf, ork, or troll).`;

    return { characterId: id, prompt };
  }

  async processStep(characterId: number, userInput: string): Promise<StepResult> {
    const character = await this.characterAccessor.getCharacter(characterId);
    if (!character) return { response: "Character not found.", nextStep: null, complete: false };
    if (character.creationStatus === "complete") {
      return { response: "Your character is already complete!", nextStep: null, complete: true };
    }

    const step = character.creationStep as CharacterCreationStep;

    switch (step) {
      case "metatype": return this.processMetatype(character, userInput);
      case "archetype": return this.processArchetype(character, userInput);
      case "attributes": return this.processAttributes(character, userInput);
      case "skills": return this.processSkills(character, userInput);
      case "qualities": return this.processQualities(character, userInput);
      case "magic": return this.processMagic(character, userInput);
      case "gear": return this.processGear(character, userInput);
      case "contacts": return this.processContacts(character, userInput);
      case "backstory": return this.processBackstory(character, userInput);
      case "review": return this.processReview(character, userInput);
      default: return { response: "Unknown step.", nextStep: null, complete: false };
    }
  }

  async cancelCreation(userId: string): Promise<{ cancelled: boolean; characterName: string | null }> {
    const inProgress = await this.characterAccessor.getInProgressCharacterForUser(userId);
    if (!inProgress) {
      return { cancelled: false, characterName: null };
    }
    const deleted = await this.characterAccessor.deleteCharacter(inProgress.id, userId);
    return { cancelled: deleted, characterName: inProgress.name };
  }

  async reopenStep(characterId: number, userId: string, step: CharacterCreationStep): Promise<StepResult> {
    const character = await this.characterAccessor.getCharacter(characterId);
    if (!character) return { response: "Character not found.", nextStep: null, complete: false };
    if (character.userId !== userId) return { response: "That's not your character.", nextStep: null, complete: false };
    if (character.creationStatus !== "complete") {
      return { response: "This character is still in progress — continue in your DMs.", nextStep: null, complete: false };
    }
    if (character.campaignId !== null) {
      return { response: "This character is linked to a campaign and can't be edited.", nextStep: null, complete: false };
    }

    const validSteps: CharacterCreationStep[] = [
      "metatype", "archetype", "attributes", "skills", "qualities", "magic", "gear", "contacts", "backstory",
    ];
    if (!validSteps.includes(step)) {
      return { response: `Invalid step. Choose: ${validSteps.join(", ")}`, nextStep: null, complete: false };
    }

    await this.characterAccessor.updateCharacter(characterId, { creationStatus: "in_progress" });
    await this.characterAccessor.setCreationStep(characterId, step);

    const updated = await this.characterAccessor.getCharacter(characterId);
    if (!updated) return { response: "Error loading character.", nextStep: null, complete: false };

    const prompt = await this.getStepPrompt(updated);
    return { response: prompt, nextStep: step, complete: false };
  }

  async getCreationStatus(userId: string, campaignId: number): Promise<CharacterCreationState | null> {
    const character = await this.characterAccessor.getCharacterByUserAndCampaign(userId, campaignId);
    if (!character || character.creationStatus === "complete") return null;
    return {
      characterId: character.id,
      currentStep: character.creationStep as CharacterCreationStep,
      campaignId: character.campaignId,
      userId: character.userId,
    };
  }

  private async processMetatype(character: CharacterRow, input: string): Promise<StepResult> {
    const metatype = input.trim().toLowerCase();
    if (!METATYPE_DATA[metatype]) {
      return {
        response: `That's not a valid metatype, chummer. Pick one: **human**, **elf**, **dwarf**, **ork**, or **troll**.`,
        nextStep: "metatype",
        complete: false,
      };
    }

    const data = METATYPE_DATA[metatype];
    await this.characterAccessor.updateCharacter(character.id, {
      metatype,
      edge: data.startingEdge,
      body: data.attributeLimits.body.min,
      agility: data.attributeLimits.agility.min,
      reaction: data.attributeLimits.reaction.min,
      strength: data.attributeLimits.strength.min,
      willpower: data.attributeLimits.willpower.min,
      logic: data.attributeLimits.logic.min,
      intuition: data.attributeLimits.intuition.min,
      charisma: data.attributeLimits.charisma.min,
    });
    await this.characterAccessor.setCreationStep(character.id, "archetype");

    const archetypeList = ARCHETYPES
      .map((a) => `**${a}** — ${ARCHETYPE_DESCRIPTIONS[a] ?? ""}`)
      .join("\n\n");
    return {
      response: `**${data.name}** — solid choice. ${data.racialAbilities.join(", ")}.\n\nNow, what's your **archetype**? This determines your role on the team, starting gear budget, and playstyle.\n\n${archetypeList}\n\nWhat are you?`,
      nextStep: "archetype",
      complete: false,
    };
  }

  private async processArchetype(character: CharacterRow, input: string): Promise<StepResult> {
    const inputLower = input.trim().toLowerCase();
    const matched = ARCHETYPES.find((a) => a.toLowerCase() === inputLower);
    if (!matched) {
      const list = ARCHETYPES.map((a) => `**${a}**`).join(", ");
      return {
        response: `Don't know that one. Pick from: ${list}`,
        nextStep: "archetype",
        complete: false,
      };
    }

    const startingNuyen = CHARACTER_CREATION.startingNuyenByArchetype[matched] ?? CHARACTER_CREATION.defaultStartingNuyen;
    await this.characterAccessor.updateCharacter(character.id, {
      archetype: matched,
      nuyen: startingNuyen,
    });
    await this.characterAccessor.setCreationStep(character.id, "attributes");

    const metatypeData = METATYPE_DATA[character.metatype];
    const attrDescriptions = Object.keys(metatypeData.attributeLimits)
      .map((attr) => {
        const limits = metatypeData.attributeLimits[attr];
        const desc = ATTRIBUTE_DESCRIPTIONS[attr] ?? attr;
        return `${desc} _(${limits.min}-${limits.max} for ${metatypeData.name})_`;
      })
      .join("\n");

    const minTotal = Object.values(metatypeData.attributeLimits).reduce((sum, l) => sum + l.min, 0);
    const pointsToSpend = CHARACTER_CREATION.attributePoints;

    return {
      response: `A **${matched}**, huh? You've got ${startingNuyen.toLocaleString()} nuyen to gear up with later.\n\nNow let's set your **attributes**. You have **${pointsToSpend} points** to distribute. Your metatype minimums are already set.\n\nHere's what each attribute does:\n${attrDescriptions}\n\nSend your attributes as: \`body agility reaction strength willpower logic intuition charisma\`\n(e.g., \`4 5 3 3 4 3 4 3\` — 8 numbers that add up to ${minTotal + pointsToSpend} total)`,
      nextStep: "attributes",
      complete: false,
    };
  }

  private async processAttributes(character: CharacterRow, input: string): Promise<StepResult> {
    const numbers = input.trim().split(/[\s,]+/).map(Number);
    if (numbers.length !== 8 || numbers.some(isNaN)) {
      return {
        response: "Need exactly 8 numbers: `body agility reaction strength willpower logic intuition charisma`",
        nextStep: "attributes",
        complete: false,
      };
    }

    const [body, agility, reaction, strength, willpower, logic, intuition, charisma] = numbers;
    const attrs = { body, agility, reaction, strength, willpower, logic, intuition, charisma };
    const metatypeData = METATYPE_DATA[character.metatype];
    const minTotal = Object.values(metatypeData.attributeLimits).reduce((sum, l) => sum + l.min, 0);

    for (const [attr, value] of Object.entries(attrs)) {
      const limits = metatypeData.attributeLimits[attr];
      if (value < limits.min || value > limits.max) {
        return {
          response: `**${attr}** must be between ${limits.min} and ${limits.max} for a ${metatypeData.name}. You put ${value}. Try again.`,
          nextStep: "attributes",
          complete: false,
        };
      }
    }

    const total = Object.values(attrs).reduce((sum, v) => sum + v, 0);
    const expected = minTotal + CHARACTER_CREATION.attributePoints;
    if (total !== expected) {
      return {
        response: `Your attributes total ${total}, but should be exactly ${expected} (${minTotal} from metatype mins + ${CHARACTER_CREATION.attributePoints} points). Adjust and try again.`,
        nextStep: "attributes",
        complete: false,
      };
    }

    const physCm = DiceEngine.physicalConditionMonitor(body);
    const stunCm = DiceEngine.stunConditionMonitor(willpower);

    await this.characterAccessor.updateCharacter(character.id, {
      ...attrs,
      physicalCmMax: physCm,
      stunCmMax: stunCm,
    });
    await this.characterAccessor.setCreationStep(character.id, "skills");

    const allSkills = Object.entries(SKILL_LIST)
      .map(([attr, skills]) => `**${attr}**: ${(skills as readonly string[]).join(", ")}`)
      .join("\n");

    return {
      response: `Attributes locked in. Physical CM: ${physCm}, Stun CM: ${stunCm}.\n\nNow for **skills**. Skills represent what your character has trained to do. When you attempt something, you roll your skill rating + the linked attribute as your dice pool. Higher rating = more dice = more hits.\n\nYou have **${CHARACTER_CREATION.skillPoints} skill points** to distribute. Max rating per skill is 6. You don't need to spend all points — unspent points are lost.\n\nAssign them as: \`SkillName:Rating, SkillName:Rating, ...\`\n(e.g., \`Pistols:5, Sneaking:4, Perception:3, Con:4, Hacking:6\`)\n\nAvailable skills (grouped by linked attribute):\n${allSkills}`,
      nextStep: "skills",
      complete: false,
    };
  }

  private async processSkills(character: CharacterRow, input: string): Promise<StepResult> {
    const lower = input.trim().toLowerCase();

    // Handle confirmation of unspent points
    if (lower === "confirm" && character.skills !== "[]") {
      const isMagic = MAGIC_ARCHETYPES.includes(character.archetype ?? "");
      const nextStep: CharacterCreationStep = "qualities";
      await this.characterAccessor.setCreationStep(character.id, nextStep);
      const existingSkills = JSON.parse(character.skills) as { name: string; rating: number }[];
      const usedPoints = existingSkills.reduce((sum, s) => sum + s.rating, 0);
      return {
        response: `Skills confirmed (${usedPoints}/${CHARACTER_CREATION.skillPoints} points used — ${CHARACTER_CREATION.skillPoints - usedPoints} points lost).\n\nNow for **qualities**. These are special traits that define your character beyond raw stats.\n\n**Positive qualities** give you an edge — examples:\n- **Toughness** — +1 to Physical Condition Monitor\n- **Ambidextrous** — No off-hand penalty\n- **Catlike** — +2 dice for Sneaking\n- **Quick Healer** — +2 dice for healing tests\n- **Analytical Mind** — +2 dice for Logic-based tests\n\n**Negative qualities** give you flaws (but more karma) — examples:\n- **SINner** — You have a legal identity (trackable by corps)\n- **Addiction** — Dependent on a substance\n- **Bad Luck** — Edge costs double\n- **Gremlins** — Tech tends to malfunction around you\n- **Prejudiced** — Bias against a group\n\nSend as: \`+QualityName, -QualityName, ...\`\n(e.g., \`+Toughness, +Ambidextrous, -SINner, -Addiction\`)\n\nOr type \`skip\` to continue without qualities.`,
        nextStep,
        complete: false,
      };
    }

    const skillEntries = input.split(",").map((s) => s.trim()).filter(Boolean);
    const skills: { name: string; rating: number; specialization?: string }[] = [];
    let totalPoints = 0;

    const allSkillNames = Object.values(SKILL_LIST).flat().map((s) => s.toLowerCase());

    for (const entry of skillEntries) {
      const match = entry.match(/^(.+?)\s*:\s*(\d+)$/);
      if (!match) {
        return {
          response: `Couldn't parse "${entry}". Use format: \`SkillName:Rating\` (e.g., \`Pistols:5\`)`,
          nextStep: "skills",
          complete: false,
        };
      }

      const name = match[1].trim();
      const rating = parseInt(match[2], 10);

      if (rating < 1 || rating > 6) {
        return {
          response: `Skill rating for "${name}" must be 1-6. You put ${rating}.`,
          nextStep: "skills",
          complete: false,
        };
      }

      if (!allSkillNames.includes(name.toLowerCase())) {
        return {
          response: `"${name}" isn't a recognized skill. Check your spelling, chummer.`,
          nextStep: "skills",
          complete: false,
        };
      }

      skills.push({ name, rating });
      totalPoints += rating;
    }

    if (totalPoints > CHARACTER_CREATION.skillPoints) {
      return {
        response: `That's ${totalPoints} skill points — you only have ${CHARACTER_CREATION.skillPoints}. Cut something.`,
        nextStep: "skills",
        complete: false,
      };
    }

    await this.characterAccessor.updateCharacter(character.id, {
      skills: JSON.stringify(skills),
    });

    // Warn about unspent points
    const unspent = CHARACTER_CREATION.skillPoints - totalPoints;
    if (unspent > 0) {
      return {
        response: `You've used **${totalPoints}/${CHARACTER_CREATION.skillPoints}** skill points — **${unspent} points unspent**. Unspent points are lost forever.\n\nType \`confirm\` to proceed anyway, or re-send your skills to adjust.`,
        nextStep: "skills",
        complete: false,
      };
    }

    const isMagic = MAGIC_ARCHETYPES.includes(character.archetype ?? "");
    const nextStep: CharacterCreationStep = "qualities";
    await this.characterAccessor.setCreationStep(character.id, nextStep);

    return {
      response: `Skills set (${totalPoints}/${CHARACTER_CREATION.skillPoints} points used).\n\nNow for **qualities**. These are special traits that define your character beyond raw stats.\n\n**Positive qualities** give you an edge — examples:\n- **Toughness** — +1 to Physical Condition Monitor\n- **Ambidextrous** — No off-hand penalty\n- **Catlike** — +2 dice for Sneaking\n- **Quick Healer** — +2 dice for healing tests\n- **Analytical Mind** — +2 dice for Logic-based tests\n\n**Negative qualities** give you flaws (but more karma) — examples:\n- **SINner** — You have a legal identity (trackable by corps)\n- **Addiction** — Dependent on a substance\n- **Bad Luck** — Edge costs double\n- **Gremlins** — Tech tends to malfunction around you\n- **Prejudiced** — Bias against a group\n\nSend as: \`+QualityName, -QualityName, ...\`\n(e.g., \`+Toughness, +Ambidextrous, -SINner, -Addiction\`)\n\nOr type \`skip\` to continue without qualities.`,
      nextStep,
      complete: false,
    };
  }

  private async processQualities(character: CharacterRow, input: string): Promise<StepResult> {
    if (input.trim().toLowerCase() === "skip") {
      const isMagic = MAGIC_ARCHETYPES.includes(character.archetype ?? "");
      const nextStep: CharacterCreationStep = isMagic ? "magic" : "gear";
      await this.characterAccessor.setCreationStep(character.id, nextStep);
      return {
        response: isMagic
          ? "No qualities, got it. Now let's talk about your **magical abilities**. What spells or powers do you want? List them separated by commas, or type `skip` if you want to handle this later."
          : "No qualities, got it. Time to go **shopping**. List the gear you want separated by commas (weapons, armor, cyberware, etc.), or type `skip` to use a default loadout.",
        nextStep,
        complete: false,
      };
    }

    const entries = input.split(",").map((s) => s.trim()).filter(Boolean);
    const qualities: { name: string; type: "positive" | "negative" }[] = [];

    for (const entry of entries) {
      if (entry.startsWith("+")) {
        qualities.push({ name: entry.slice(1).trim(), type: "positive" });
      } else if (entry.startsWith("-")) {
        qualities.push({ name: entry.slice(1).trim(), type: "negative" });
      } else {
        qualities.push({ name: entry, type: "positive" });
      }
    }

    await this.characterAccessor.updateCharacter(character.id, {
      qualities: JSON.stringify(qualities),
    });

    const isMagic = MAGIC_ARCHETYPES.includes(character.archetype ?? "");
    const nextStep: CharacterCreationStep = isMagic ? "magic" : "gear";
    await this.characterAccessor.setCreationStep(character.id, nextStep);

    const positiveCount = qualities.filter((q) => q.type === "positive").length;
    const negativeCount = qualities.filter((q) => q.type === "negative").length;

    return {
      response: `Qualities recorded (${positiveCount} positive, ${negativeCount} negative).\n\n${
        isMagic
          ? "Now let's talk about your **magical abilities**. List your spells/powers separated by commas, or type `skip`."
          : "Time to go **shopping**. List your gear (weapons, armor, cyberware, etc.) separated by commas, or type `skip` for a default loadout."
      }`,
      nextStep,
      complete: false,
    };
  }

  private async processMagic(character: CharacterRow, input: string): Promise<StepResult> {
    if (input.trim().toLowerCase() !== "skip") {
      const spells = input.split(",").map((s) => ({ name: s.trim() })).filter((s) => s.name);
      const magicRating = character.archetype === "Adept" ? 4 : 3;

      await this.characterAccessor.updateCharacter(character.id, {
        spells: JSON.stringify(spells),
        magic: magicRating,
      });
    }

    await this.characterAccessor.setCreationStep(character.id, "gear");

    return {
      response: `Magical abilities noted.\n\nTime to go **shopping**. You have **${character.nuyen.toLocaleString()} nuyen**. List gear separated by commas (weapons, armor, cyberware, commlink, etc.), or type \`skip\` for a default loadout.\n\nFormat: \`Ares Predator V, Armor Jacket, Datajack, Erika MCD-1 Commlink\``,
      nextStep: "gear",
      complete: false,
    };
  }

  private async processGear(character: CharacterRow, input: string): Promise<StepResult> {
    if (input.trim().toLowerCase() === "skip") {
      const defaultGear = this.getDefaultGear(character.archetype ?? "Street Samurai");
      await this.characterAccessor.updateCharacter(character.id, {
        gear: JSON.stringify(defaultGear),
      });
    } else {
      const gear = input.split(",").map((g) => ({ name: g.trim(), category: "general" })).filter((g) => g.name);
      await this.characterAccessor.updateCharacter(character.id, {
        gear: JSON.stringify(gear),
      });
    }

    await this.characterAccessor.setCreationStep(character.id, "contacts");

    return {
      response: `Gear stashed.\n\nEvery runner needs **contacts**. Define 1-3 contacts:\n\`Name:Connection:Loyalty\` (Connection 1-6, Loyalty 1-6)\n(e.g., \`Dodger:4:2, Mama Cass:2:5\`)\n\nOr type \`skip\` for a default fixer.`,
      nextStep: "contacts",
      complete: false,
    };
  }

  private async processContacts(character: CharacterRow, input: string): Promise<StepResult> {
    if (input.trim().toLowerCase() === "skip") {
      const defaultContacts = [{ name: "Fingers", connection: 3, loyalty: 2, description: "Local fixer" }];
      await this.characterAccessor.updateCharacter(character.id, {
        contacts: JSON.stringify(defaultContacts),
      });
    } else {
      const entries = input.split(",").map((s) => s.trim()).filter(Boolean);
      const contacts: { name: string; connection: number; loyalty: number }[] = [];

      for (const entry of entries) {
        const parts = entry.split(":").map((p) => p.trim());
        if (parts.length >= 3) {
          contacts.push({
            name: parts[0],
            connection: Math.min(6, Math.max(1, parseInt(parts[1], 10) || 1)),
            loyalty: Math.min(6, Math.max(1, parseInt(parts[2], 10) || 1)),
          });
        } else {
          contacts.push({ name: entry, connection: 2, loyalty: 2 });
        }
      }

      await this.characterAccessor.updateCharacter(character.id, {
        contacts: JSON.stringify(contacts),
      });
    }

    await this.characterAccessor.setCreationStep(character.id, "backstory");

    return {
      response: `Contacts noted.\n\nLast thing before review — give me a quick **backstory**. A few sentences about who you are and why you're running the shadows. This helps the GM weave your story in.\n\nOr type \`skip\` to let the GM fill it in.`,
      nextStep: "backstory",
      complete: false,
    };
  }

  private async processBackstory(character: CharacterRow, input: string): Promise<StepResult> {
    if (input.trim().toLowerCase() !== "skip") {
      try {
        const messages: OllamaChatMessage[] = [
          {
            role: "system",
            content: `${CREATION_SYSTEM_PROMPT}\n\nThe player has provided a backstory for their ${character.metatype} ${character.archetype ?? "runner"} named ${character.name}. Polish it into a 2-3 sentence backstory in third person, keeping the player's core ideas. Be concise.`,
          },
          { role: "user", content: input },
        ];
        await this.ollamaAccessor.chat(messages);
      } catch (error) {
        logger.error("Backstory generation failed, using raw input:", error);
      }
    }

    await this.characterAccessor.setCreationStep(character.id, "review");
    const updated = await this.characterAccessor.getCharacter(character.id);
    if (!updated) return { response: "Error loading character.", nextStep: null, complete: false };

    const summary = this.buildReviewSummary(updated);
    return {
      response: `Here's your character sheet:\n\n${summary}\n\nType **done** to finalize, or the name of a step to go back to (metatype, archetype, attributes, skills, qualities, magic, gear, contacts, backstory).`,
      nextStep: "review",
      complete: false,
    };
  }

  private async processReview(character: CharacterRow, input: string): Promise<StepResult> {
    const lower = input.trim().toLowerCase();

    if (lower === "done" || lower === "confirm" || lower === "yes") {
      await this.characterAccessor.markCreationComplete(character.id);
      return {
        response: `**${character.name}** is locked and loaded. You're ready to run the shadows, chummer. Head back to the campaign channel — the GM is waiting.`,
        nextStep: null,
        complete: true,
      };
    }

    const validSteps: CharacterCreationStep[] = [
      "metatype", "archetype", "attributes", "skills", "qualities", "magic", "gear", "contacts", "backstory",
    ];
    if (validSteps.includes(lower as CharacterCreationStep)) {
      await this.characterAccessor.setCreationStep(character.id, lower);
      const updated = await this.characterAccessor.getCharacter(character.id);
      if (!updated) return { response: "Error loading character.", nextStep: null, complete: false };
      return { response: await this.getStepPrompt(updated), nextStep: lower as CharacterCreationStep, complete: false };
    }

    return {
      response: "Type **done** to finalize, or a step name to go back (metatype, archetype, attributes, skills, qualities, magic, gear, contacts, backstory).",
      nextStep: "review",
      complete: false,
    };
  }

  private async getStepPrompt(character: CharacterRow): Promise<string> {
    const step = character.creationStep as CharacterCreationStep;
    switch (step) {
      case "metatype":
        return "Pick your **metatype**: human, elf, dwarf, ork, or troll.";
      case "archetype":
        return `Pick your **archetype**: ${ARCHETYPES.join(", ")}`;
      case "attributes":
        return `Set your **attributes** (8 numbers): \`body agility reaction strength willpower logic intuition charisma\``;
      case "skills":
        return `Set your **skills**: \`SkillName:Rating, SkillName:Rating, ...\` (${CHARACTER_CREATION.skillPoints} points)`;
      case "qualities":
        return `Set **qualities**: \`+Positive, -Negative, ...\` or type \`skip\``;
      case "magic":
        return `Set **spells/powers** (comma-separated) or type \`skip\``;
      case "gear":
        return `List **gear** (comma-separated) or type \`skip\` for defaults`;
      case "contacts":
        return `Define **contacts**: \`Name:Connection:Loyalty\` or type \`skip\``;
      case "backstory":
        return `Give a quick **backstory** or type \`skip\``;
      case "review": {
        const summary = this.buildReviewSummary(character);
        return `${summary}\n\nType **done** to finalize or a step name to go back.`;
      }
      default:
        return "Your character creation is in an unknown state. Contact the GM.";
    }
  }

  private buildReviewSummary(character: CharacterRow): string {
    const skills = JSON.parse(character.skills) as { name: string; rating: number }[];
    const qualities = JSON.parse(character.qualities) as { name: string; type: string }[];
    const spells = JSON.parse(character.spells) as { name: string }[];
    const gear = JSON.parse(character.gear) as { name: string }[];
    const contacts = JSON.parse(character.contacts) as { name: string; connection: number; loyalty: number }[];

    const lines: string[] = [
      `**${character.name}** — ${METATYPE_DATA[character.metatype]?.name ?? character.metatype} ${character.archetype ?? ""}`,
      `BOD ${character.body} | AGI ${character.agility} | REA ${character.reaction} | STR ${character.strength}`,
      `WIL ${character.willpower} | LOG ${character.logic} | INT ${character.intuition} | CHA ${character.charisma}`,
      `Edge ${character.edge} | Essence ${character.essence}${character.magic ? ` | Magic ${character.magic}` : ""}`,
    ];

    if (skills.length > 0) {
      lines.push(`Skills: ${skills.map((s) => `${s.name} ${s.rating}`).join(", ")}`);
    }
    if (qualities.length > 0) {
      lines.push(`Qualities: ${qualities.map((q) => `${q.type === "positive" ? "+" : "-"}${q.name}`).join(", ")}`);
    }
    if (spells.length > 0) {
      lines.push(`Spells: ${spells.map((s) => s.name).join(", ")}`);
    }
    if (gear.length > 0) {
      lines.push(`Gear: ${gear.map((g) => g.name).join(", ")}`);
    }
    if (contacts.length > 0) {
      lines.push(`Contacts: ${contacts.map((c) => `${c.name} (C${c.connection}/L${c.loyalty})`).join(", ")}`);
    }
    lines.push(`Nuyen: ${character.nuyen.toLocaleString()} | Karma: ${character.karma}`);

    return lines.join("\n");
  }

  private getDefaultGear(archetype: string): { name: string; category: string }[] {
    const base = [
      { name: "Armor Jacket", category: "armor" },
      { name: "Meta Link Commlink", category: "electronics" },
      { name: "Fake SIN (Rating 4)", category: "identity" },
    ];

    switch (archetype) {
      case "Street Samurai":
      case "Weapons Specialist":
        return [...base,
          { name: "Ares Predator V", category: "weapon" },
          { name: "Katana", category: "weapon" },
          { name: "Wired Reflexes (Rating 1)", category: "cyberware" },
        ];
      case "Decker":
        return [...base,
          { name: "Hermes Chariot Cyberdeck", category: "electronics" },
          { name: "Light Pistol", category: "weapon" },
        ];
      case "Mage":
      case "Shaman":
        return [...base,
          { name: "Power Focus (Rating 2)", category: "focus" },
          { name: "Sustaining Focus (Rating 2)", category: "focus" },
        ];
      case "Adept":
      case "Mystic Adept":
        return [...base,
          { name: "Katana", category: "weapon" },
          { name: "Qi Focus (Rating 2)", category: "focus" },
        ];
      case "Rigger":
        return [...base,
          { name: "Steel Lynx Combat Drone", category: "drone" },
          { name: "Fly-Spy Drone", category: "drone" },
          { name: "Control Rig (Rating 1)", category: "cyberware" },
        ];
      case "Face":
        return [...base,
          { name: "Actioneer Business Clothes", category: "armor" },
          { name: "Light Pistol", category: "weapon" },
          { name: "Tailored Pheromones (Rating 2)", category: "bioware" },
        ];
      default:
        return [...base, { name: "Light Pistol", category: "weapon" }];
    }
  }
}
