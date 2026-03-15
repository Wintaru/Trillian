import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { LessonEngine } from "../engines/lesson-engine.js";
import { languageName } from "../engines/translate-engine.js";

const HELP_DESCRIPTION = [
  "**Language Lessons** — Private tutoring via DM!",
  "",
  "`/lesson start [language]` — Start a new lesson in your DMs",
  "`/lesson stop` — End your current lesson",
  "`/lesson status` — Check if you have an active lesson",
  "",
  "Lessons are conducted privately via direct messages with the bot.",
].join("\n");

export function createLessonCommand(lessonEngine: LessonEngine, defaultLanguage: string): Command {
  return {
    name: "lesson",
    description: "Start, stop, or check status of a private language lesson",
    slashData: new SlashCommandBuilder()
      .setName("lesson")
      .setDescription("Private language tutoring via DM")
      .addSubcommand((sub) =>
        sub
          .setName("start")
          .setDescription("Start a new lesson in your DMs")
          .addStringOption((opt) =>
            opt
              .setName("language")
              .setDescription("Language code (e.g. ES, FR, DE). Defaults to server setting.")
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("stop").setDescription("End your current lesson"),
      )
      .addSubcommand((sub) =>
        sub.setName("status").setDescription("Check if you have an active lesson"),
      )
      .addSubcommand((sub) =>
        sub.setName("help").setDescription("Show available lesson commands"),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const subcommand = interaction.options.getSubcommand();
      const userId = interaction.user.id;

      if (subcommand === "start") {
        await handleStart(interaction, lessonEngine, userId, defaultLanguage);
      } else if (subcommand === "stop") {
        await handleStop(interaction, lessonEngine, userId);
      } else if (subcommand === "status") {
        await handleStatus(interaction, lessonEngine, userId);
      } else if (subcommand === "help") {
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Language Lessons — Help").setDescription(HELP_DESCRIPTION).setColor(0xe67e22)], flags: 64 });
      }
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      const subcommand = context.args[0]?.toLowerCase();
      const userId = message.author.id;

      if (!subcommand || subcommand === "help" || !["start", "stop", "status"].includes(subcommand)) {
        await message.reply({ embeds: [new EmbedBuilder().setTitle("Language Lessons — Help").setDescription(HELP_DESCRIPTION).setColor(0xe67e22)] });
        return;
      }

      if (subcommand === "start") {
        const language = context.args[1]?.toUpperCase() || defaultLanguage;
        try {
          const result = await lessonEngine.startLesson({ userId, language });
          await message.author.send(result.greeting.slice(0, 2000));
          await message.reply(`Your ${languageName(language)} lesson has started! Check your DMs.`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "An unknown error occurred.";
          await message.reply(msg);
        }
      } else if (subcommand === "stop") {
        const result = await lessonEngine.stopLesson({ userId });
        if (result.ended) {
          await message.reply("Your lesson has ended. Great work!");
        } else {
          await message.reply("You don't have an active lesson.");
        }
      } else if (subcommand === "status") {
        const status = await lessonEngine.getStatus({ userId });
        if (status.active) {
          const started = new Date(status.startedAt!).toLocaleString();
          await message.reply(`You have an active ${languageName(status.language!)} lesson (started ${started}).`);
        } else {
          await message.reply("You don't have an active lesson. Use `!lesson start` to begin one.");
        }
      }
    },
  };
}

async function handleStart(
  interaction: ChatInputCommandInteraction,
  lessonEngine: LessonEngine,
  userId: string,
  defaultLanguage: string,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const language = interaction.options.getString("language")?.toUpperCase() || defaultLanguage;

  try {
    const result = await lessonEngine.startLesson({ userId, language });
    await interaction.user.send(result.greeting.slice(0, 2000));
    await interaction.editReply(`Your ${languageName(language)} lesson has started! Check your DMs.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unknown error occurred.";
    await interaction.editReply(msg);
  }
}

async function handleStop(
  interaction: ChatInputCommandInteraction,
  lessonEngine: LessonEngine,
  userId: string,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const result = await lessonEngine.stopLesson({ userId });
  if (result.ended) {
    await interaction.editReply("Your lesson has ended. Great work!");
  } else {
    await interaction.editReply("You don't have an active lesson.");
  }
}

async function handleStatus(
  interaction: ChatInputCommandInteraction,
  lessonEngine: LessonEngine,
  userId: string,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const status = await lessonEngine.getStatus({ userId });
  if (status.active) {
    const started = new Date(status.startedAt!).toLocaleString();
    await interaction.editReply(`You have an active ${languageName(status.language!)} lesson (started ${started}).`);
  } else {
    await interaction.editReply("You don't have an active lesson. Use `/lesson start` to begin one.");
  }
}
