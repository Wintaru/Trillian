import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { OllamaAccessor, OllamaChatMessage } from "../accessors/ollama-accessor.js";
import { METATYPE_DATA, ARCHETYPES, SKILL_LIST, LIFESTYLE_COSTS } from "../utilities/shadowrun-reference.js";
import * as logger from "../utilities/logger.js";

const STATIC_TOPICS: Record<string, () => string> = {
  metatypes: () => {
    const entries = Object.entries(METATYPE_DATA).map(([key, data]) =>
      `**${data.name}** — ${Object.entries(data.attributeLimits).map(([attr, l]) => `${attr.slice(0, 3).toUpperCase()} ${l.min}-${l.max}`).join(", ")}\nAbilities: ${data.racialAbilities.join(", ")}`,
    );
    return `**Shadowrun Metatypes**\n\n${entries.join("\n\n")}`;
  },
  archetypes: () => {
    const descriptions: Record<string, string> = {
      "Street Samurai": "Combat specialist. Heavy cyberware, big guns, fast reflexes.",
      "Decker": "Matrix hacker. Lives in the code, breaks through ICE, steals data.",
      "Rigger": "Drone and vehicle operator. Sees through mechanical eyes.",
      "Mage": "Hermetic spellcaster. Intellectual approach to magic. Summons elementals.",
      "Shaman": "Intuitive spellcaster. Spiritual tradition. Summons nature spirits.",
      "Adept": "Channels magic into physical abilities. Superhuman martial artist.",
      "Mystic Adept": "Hybrid mage/adept. Casts spells and has physical powers.",
      "Technomancer": "Natural Matrix user. No deck needed — their mind IS the deck.",
      "Face": "Social specialist. Talks their way in (or out) of anything.",
      "Physical Infiltrator": "Stealth expert. B&E, security bypass, shadow work.",
      "Weapons Specialist": "Ranged combat expert. Every gun is their best friend.",
    };
    const lines = ARCHETYPES.map((a) => `**${a}** — ${descriptions[a] ?? ""}`);
    return `**Shadowrun Archetypes**\n\n${lines.join("\n")}`;
  },
  skills: () => {
    const sections = Object.entries(SKILL_LIST).map(([attr, skills]) =>
      `**${attr.charAt(0).toUpperCase() + attr.slice(1)}**: ${(skills as readonly string[]).join(", ")}`,
    );
    return `**Shadowrun Skills by Attribute**\n\n${sections.join("\n\n")}`;
  },
  lifestyles: () => {
    const lines = Object.entries(LIFESTYLE_COSTS).map(([name, cost]) =>
      `**${name.charAt(0).toUpperCase() + name.slice(1)}** — ${cost === 0 ? "Free" : `${cost.toLocaleString()} nuyen/month`}`,
    );
    return `**Shadowrun Lifestyles**\n\n${lines.join("\n")}`;
  },
  dice: () =>
    `**Shadowrun Dice System**\n\nRoll a pool of **d6s** (Attribute + Skill + modifiers).\n- **5 or 6** = 1 hit\n- Hits capped by **Limit** (Physical, Mental, or Social)\n- **Glitch**: More than half the dice show 1\n- **Critical Glitch**: Glitch + zero hits\n\n**Edge Spending:**\n- Push the Limit: +Edge dice, ignore limit\n- Second Chance: Reroll all non-hits\n- Seize Initiative: Go first\n- Blitz: Roll 5d6 for initiative`,
  combat: () =>
    `**Shadowrun Combat Basics**\n\n**Initiative**: REA + INT + 1d6\n**Ranged Attack**: Weapon Skill + AGI [Accuracy] vs. REA + INT\n**Melee Attack**: Weapon Skill + AGI [Accuracy] vs. REA + INT (or Weapon Skill + INT if defender has melee weapon)\n\nNet hits add to weapon **Damage Value (DV)**.\nIf modified DV > Armor = **Physical** damage.\nIf modified DV <= Armor = **Stun** damage.\n**Soak**: BOD + Armor, each hit reduces DV.\n\n**Condition Monitors**: Physical = ceil(BOD/2)+8, Stun = ceil(WIL/2)+8\nEvery 3 boxes = -1 to all dice pools.`,
  magic: () =>
    `**Shadowrun Magic**\n\n**Traditions**: Hermetic (drain: LOG+WIL) or Shamanic (drain: CHA+WIL)\n**Spellcasting**: Spellcasting + Magic [Force] vs. threshold\n**Drain**: If Force > Magic, drain is Physical; otherwise Stun\n**Summoning**: Summoning + Magic vs. Spirit Force. Net hits = services owed.\n\n**Spell Categories**: Combat, Detection, Health, Illusion, Manipulation\n**Adept Powers**: Internal magic (physical/mental enhancements via Power Points = Magic rating)`,
  matrix: () =>
    `**Shadowrun Matrix**\n\n**Cyberdeck Attributes**: Attack, Sleaze, Data Processing, Firewall\n**Marks**: Need 1-3 marks for access (hack via Sleaze or brute force via Attack)\n**Modes**: AR (physical initiative), Cold-Sim VR (+3d6 init), Hot-Sim VR (+4d6 init, +2 to Matrix actions, biofeedback = Physical)\n**Overwatch Score**: Accumulates from illegal actions. At 40, GOD converges — forced reboot, location revealed.\n**IC Types**: Patrol, Killer, Black (biofeedback), Track, and more.`,
};

const TOPIC_ALIASES: Record<string, string> = {
  metatype: "metatypes", races: "metatypes", race: "metatypes",
  archetype: "archetypes", classes: "archetypes", class: "archetypes", roles: "archetypes",
  skill: "skills",
  lifestyle: "lifestyles",
  roll: "dice", rolls: "dice", rolling: "dice",
  fight: "combat", fighting: "combat",
  spell: "magic", spells: "magic", mage: "magic",
  hack: "matrix", hacking: "matrix", decker: "matrix", deck: "matrix",
};

export function createShadowrunInfoCommand(ollamaAccessor: OllamaAccessor): Command {
  return {
    name: "shadowrun",
    description: "Look up Shadowrun game information",
    slashData: new SlashCommandBuilder()
      .setName("shadowrun")
      .setDescription("Look up Shadowrun game information")
      .addSubcommand((sub) =>
        sub
          .setName("info")
          .setDescription("Get info about a Shadowrun topic")
          .addStringOption((opt) =>
            opt.setName("topic").setDescription("Topic to look up (metatypes, archetypes, skills, dice, combat, magic, matrix, lifestyles)").setRequired(true),
          ),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const topic = interaction.options.getString("topic", true).toLowerCase().trim();
      const resolved = TOPIC_ALIASES[topic] ?? topic;
      const staticHandler = STATIC_TOPICS[resolved];

      if (staticHandler) {
        await interaction.reply({ content: staticHandler(), flags: 64 });
        return;
      }

      await interaction.deferReply({ flags: 64 });
      try {
        const answer = await queryOllama(topic);
        await interaction.editReply(answer.slice(0, 2000));
      } catch {
        await interaction.editReply("Couldn't find info on that topic. Try: metatypes, archetypes, skills, dice, combat, magic, matrix, lifestyles.");
      }
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      const sub = context.args[0]?.toLowerCase();
      if (sub !== "info" || !context.args[1]) {
        await message.reply("Usage: `!shadowrun info <topic>` (metatypes, archetypes, skills, dice, combat, magic, matrix, lifestyles)");
        return;
      }

      const topic = context.args.slice(1).join(" ").toLowerCase().trim();
      const resolved = TOPIC_ALIASES[topic] ?? topic;
      const staticHandler = STATIC_TOPICS[resolved];

      if (staticHandler) {
        await message.reply(staticHandler());
        return;
      }

      try {
        const answer = await queryOllama(topic);
        await message.reply(answer.slice(0, 2000));
      } catch {
        await message.reply("Couldn't find info on that. Try: metatypes, archetypes, skills, dice, combat, magic, matrix, lifestyles.");
      }
    },
  };

  async function queryOllama(topic: string): Promise<string> {
    const messages: OllamaChatMessage[] = [
      {
        role: "system",
        content: "You are a Shadowrun 5th Edition rules expert. Answer questions about Shadowrun concisely and accurately. Keep responses under 1500 characters. Stay focused on game mechanics and lore.",
      },
      { role: "user", content: `Tell me about: ${topic}` },
    ];
    return ollamaAccessor.chat(messages);
  }
}
