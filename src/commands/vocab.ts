import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { VocabEngine } from "../engines/vocab-engine.js";
import { buildVocabQuizEmbed, buildVocabListEmbed } from "../utilities/vocab-embed.js";

export function createVocabCommand(vocabEngine: VocabEngine): Command {
  return {
    name: "vocab",
    description: "Review, list, and quiz your saved vocabulary",
    slashData: new SlashCommandBuilder()
      .setName("vocab")
      .setDescription("Review, list, and quiz your saved vocabulary")
      .addSubcommand((sub) =>
        sub.setName("review").setDescription("Take a quiz on a random saved word"),
      )
      .addSubcommand((sub) =>
        sub.setName("list").setDescription("View your saved vocabulary words"),
      )
      .addSubcommand((sub) =>
        sub.setName("stats").setDescription("View your vocabulary review stats"),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const subcommand = interaction.options.getSubcommand();
      const userId = interaction.user.id;

      if (subcommand === "review") {
        await handleReview(interaction, vocabEngine, userId);
      } else if (subcommand === "list") {
        await handleList(interaction, vocabEngine, userId);
      } else if (subcommand === "stats") {
        await handleStats(interaction, vocabEngine, userId);
      }
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      const subcommand = context.args[0]?.toLowerCase();
      const userId = message.author.id;

      if (!subcommand || !["review", "list", "stats"].includes(subcommand)) {
        await message.reply("Usage: `!vocab review`, `!vocab list`, or `!vocab stats`");
        return;
      }

      if (subcommand === "review") {
        await handleReviewPrefix(message, vocabEngine, userId);
      } else if (subcommand === "list") {
        await handleListPrefix(message, vocabEngine, userId);
      } else if (subcommand === "stats") {
        await handleStatsPrefix(message, vocabEngine, userId);
      }
    },
  };
}

async function handleReview(
  interaction: ChatInputCommandInteraction,
  vocabEngine: VocabEngine,
  userId: string,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  try {
    const quiz = await vocabEngine.getQuiz({ userId });
    if (!quiz) {
      await interaction.editReply("You haven't saved any vocabulary words yet. Save some from the daily Word of the Day posts!");
      return;
    }

    const embed = buildVocabQuizEmbed(quiz);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...quiz.options.map((option, index) =>
        new ButtonBuilder()
          .setCustomId(`vocab_quiz_answer:${quiz.dailyWordId}:${index}:${quiz.correctIndex}`)
          .setLabel(option)
          .setStyle(ButtonStyle.Secondary),
      ),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unknown error occurred.";
    await interaction.editReply(`Failed to load quiz: ${msg}`);
  }
}

async function handleList(
  interaction: ChatInputCommandInteraction,
  vocabEngine: VocabEngine,
  userId: string,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  try {
    const entries = await vocabEngine.listVocab(userId);
    const embed = buildVocabListEmbed(entries);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unknown error occurred.";
    await interaction.editReply(`Failed to load vocabulary: ${msg}`);
  }
}

async function handleStats(
  interaction: ChatInputCommandInteraction,
  vocabEngine: VocabEngine,
  userId: string,
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  try {
    const stats = await vocabEngine.getStats({ userId });
    const lines = [
      `**Total Words Saved:** ${stats.totalWords}`,
      `**Total Reviews:** ${stats.totalReviews}`,
      `**Correct Answers:** ${stats.totalCorrect}`,
      `**Accuracy:** ${stats.accuracy}%`,
    ];
    await interaction.editReply(lines.join("\n"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unknown error occurred.";
    await interaction.editReply(`Failed to load stats: ${msg}`);
  }
}

async function handleReviewPrefix(
  message: Message,
  vocabEngine: VocabEngine,
  userId: string,
): Promise<void> {
  try {
    const quiz = await vocabEngine.getQuiz({ userId });
    if (!quiz) {
      await message.reply("You haven't saved any vocabulary words yet. Save some from the daily Word of the Day posts!");
      return;
    }

    const embed = buildVocabQuizEmbed(quiz);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...quiz.options.map((option, index) =>
        new ButtonBuilder()
          .setCustomId(`vocab_quiz_answer:${quiz.dailyWordId}:${index}:${quiz.correctIndex}`)
          .setLabel(option)
          .setStyle(ButtonStyle.Secondary),
      ),
    );

    if (message.channel.isSendable()) {
      await message.channel.send({ embeds: [embed], components: [row] });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unknown error occurred.";
    await message.reply(`Failed to load quiz: ${msg}`);
  }
}

async function handleListPrefix(
  message: Message,
  vocabEngine: VocabEngine,
  userId: string,
): Promise<void> {
  try {
    const entries = await vocabEngine.listVocab(userId);
    const embed = buildVocabListEmbed(entries);
    if (message.channel.isSendable()) {
      await message.channel.send({ embeds: [embed] });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unknown error occurred.";
    await message.reply(`Failed to load vocabulary: ${msg}`);
  }
}

async function handleStatsPrefix(
  message: Message,
  vocabEngine: VocabEngine,
  userId: string,
): Promise<void> {
  try {
    const stats = await vocabEngine.getStats({ userId });
    const lines = [
      `**Total Words Saved:** ${stats.totalWords}`,
      `**Total Reviews:** ${stats.totalReviews}`,
      `**Correct Answers:** ${stats.totalCorrect}`,
      `**Accuracy:** ${stats.accuracy}%`,
    ];
    await message.reply(lines.join("\n"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unknown error occurred.";
    await message.reply(`Failed to load stats: ${msg}`);
  }
}
