import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";

const INTRO_COLOR = 0x5865f2;

function buildIntroEmbed(prefix: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Hi, I'm Trillian!")
    .setColor(INTRO_COLOR)
    .setDescription(
      "I'm the server's bot. Here's everything I can help you with:",
    )
    .addFields(
      {
        name: "💬 Chat",
        value:
          "Mention me or reply to one of my messages and I'll chat with you. I also occasionally chime into conversations on my own.",
      },
      {
        name: "⭐ XP & Leveling",
        value: [
          `\`/rank\` — Check your level, XP, and rank`,
          `\`/leaderboard\` — See the server XP leaderboard`,
          `\`/xp\` — Manage XP (mod only)`,
        ].join("\n"),
      },
      {
        name: "🗳️ Polls",
        value: `\`/poll\` — Create an anonymous poll`,
      },
      {
        name: "🌤️ Weather",
        value: `\`/weather\` — Get current weather and forecast for a location`,
      },
      {
        name: "📖 Dictionary & Translation",
        value: [
          `\`/define\` — Look up the definition of an English word`,
          `\`/translate\` — Translate text between languages`,
        ].join("\n"),
      },
      {
        name: "🗣️ Language Learning",
        value: [
          `\`/vocab\` — Review, list, and quiz your saved vocabulary`,
          `\`/lesson\` — Start a private language lesson`,
          `\`/challenge\` — View translation challenge results`,
        ].join("\n"),
      },
      {
        name: "🎵 Music Club",
        value: `\`/musicclub\` — Submit songs, rate, and discover new music`,
      },
      {
        name: "🍳 Recipes",
        value: `\`/recipe\` — Browse and search the recipe book`,
      },
      {
        name: "📚 Library",
        value: `\`/library\` — Community library — share, borrow, and discover books`,
      },
      {
        name: "🎲 Shadowrun",
        value: [
          `\`/roll\` — Roll Shadowrun dice`,
          `\`/campaign\` — Manage Shadowrun campaigns`,
          `\`/character\` — Manage Shadowrun characters`,
          `\`/shadowrun-info\` — Look up Shadowrun game information`,
        ].join("\n"),
      },
      {
        name: "🛠️ Utilities",
        value: [
          `\`/remind\` — Set personal reminders`,
          `\`/birthday\` — Track and celebrate birthdays (mod only)`,
          `\`/cleanurl\` — Remove tracking parameters from a URL`,
          `\`/embed\` — Create and manage custom embeds`,
          `\`/channelstats\` — Show today's channel activity stats`,
          `\`/ping\` — Check if I'm alive`,
        ].join("\n"),
      },
    )
    .setFooter({
      text: `You can also use the "${prefix}" prefix for most commands (e.g. ${prefix}rank)`,
    });
}

export function createIntroductionCommand(prefix: string): Command {
  return {
    name: "introduction",
    description: "Get a personal overview of all bot features",
    slashData: new SlashCommandBuilder()
      .setName("introduction")
      .setDescription("Get a personal overview of all bot features"),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      await interaction.reply({
        embeds: [buildIntroEmbed(prefix)],
        flags: ["Ephemeral"],
      });
    },

    async executePrefix(message: Message, _context: CommandContext): Promise<void> {
      await message.reply({ embeds: [buildIntroEmbed(prefix)] });
    },
  };
}
