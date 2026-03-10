import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { ButtonInteraction } from "discord.js";
import type { ButtonHandler } from "../types/button-handler.js";
import type { VocabEngine } from "./vocab-engine.js";
import {
  buildFlashcardFrontEmbed,
  buildFlashcardBackEmbed,
  buildFlashcardRatedEmbed,
} from "../utilities/vocab-embed.js";
import { SM2_QUALITY_AGAIN, SM2_QUALITY_HARD, SM2_QUALITY_GOOD, SM2_QUALITY_EASY } from "../utilities/sm2.js";
import * as logger from "../utilities/logger.js";

const QUALITY_LABELS: Record<number, string> = {
  [SM2_QUALITY_AGAIN]: "Again",
  [SM2_QUALITY_HARD]: "Hard",
  [SM2_QUALITY_GOOD]: "Good",
  [SM2_QUALITY_EASY]: "Easy",
};

export class VocabButtonHandler implements ButtonHandler {
  constructor(private vocabEngine: VocabEngine) {}

  canHandle(customId: string): boolean {
    return customId.startsWith("vocab_");
  }

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    if (customId.startsWith("vocab_save:")) {
      await this.handleSave(interaction);
    } else if (customId.startsWith("vocab_quiz_answer:")) {
      await this.handleQuizAnswer(interaction);
    } else if (customId.startsWith("vocab_fc_flip:")) {
      await this.handleFlashcardFlip(interaction);
    } else if (customId.startsWith("vocab_fc_rate:")) {
      await this.handleFlashcardRate(interaction);
    } else if (customId === "vocab_fc_next") {
      await this.handleFlashcardNext(interaction);
    }
  }

  private async handleSave(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(":");
    const dailyWordId = parseInt(parts[1], 10);

    try {
      const result = await this.vocabEngine.saveWord({
        userId: interaction.user.id,
        dailyWordId,
      });

      const message = result.reason === "saved"
        ? "Saved to your vocabulary!"
        : "You already saved this word.";

      await interaction.reply({ content: message, flags: 64 });
    } catch (err) {
      logger.error("Failed to save vocab word:", err);
      await interaction.reply({ content: "Failed to save word.", flags: 64 });
    }
  }

  private async handleQuizAnswer(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(":");
    const dailyWordId = parseInt(parts[1], 10);
    const selectedIndex = parseInt(parts[2], 10);
    const correctIndex = parseInt(parts[3], 10);

    try {
      const result = await this.vocabEngine.answerQuiz({
        userId: interaction.user.id,
        dailyWordId,
        selectedIndex,
        correctIndex,
      });

      const emoji = result.correct ? "Correct!" : "Incorrect.";
      const answer = result.correctAnswer ? ` The answer was **${result.correctAnswer}**.` : "";
      const stats = `(${result.correctCount}/${result.reviewCount} correct)`;

      await interaction.reply({
        content: `${emoji}${answer} ${stats}`,
        flags: 64,
      });
    } catch (err) {
      logger.error("Failed to record quiz answer:", err);
      await interaction.reply({ content: "Failed to record answer.", flags: 64 });
    }
  }

  private async handleFlashcardFlip(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(":");
    const dailyWordId = parseInt(parts[1], 10);

    try {
      const card = await this.vocabEngine.getFlashcardByWordId(interaction.user.id, dailyWordId);
      if (!card) {
        await interaction.update({ embeds: [], components: [], content: "Word not found." });
        return;
      }

      const embed = buildFlashcardBackEmbed(card);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`vocab_fc_rate:${dailyWordId}:${SM2_QUALITY_AGAIN}`)
          .setLabel("Again")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`vocab_fc_rate:${dailyWordId}:${SM2_QUALITY_HARD}`)
          .setLabel("Hard")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`vocab_fc_rate:${dailyWordId}:${SM2_QUALITY_GOOD}`)
          .setLabel("Good")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`vocab_fc_rate:${dailyWordId}:${SM2_QUALITY_EASY}`)
          .setLabel("Easy")
          .setStyle(ButtonStyle.Success),
      );

      await interaction.update({ embeds: [embed], components: [row] });
    } catch (err) {
      logger.error("Failed to flip flashcard:", err);
      await interaction.update({ embeds: [], components: [], content: "Failed to load card." });
    }
  }

  private async handleFlashcardRate(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(":");
    const dailyWordId = parseInt(parts[1], 10);
    const quality = parseInt(parts[2], 10);

    try {
      const result = await this.vocabEngine.rateFlashcard({
        userId: interaction.user.id,
        dailyWordId,
        quality,
      });

      const label = QUALITY_LABELS[quality] ?? "Unknown";
      const embed = buildFlashcardRatedEmbed(label, result.interval);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("vocab_fc_next")
          .setLabel("Next Card")
          .setStyle(ButtonStyle.Primary),
      );

      await interaction.update({ embeds: [embed], components: [row] });
    } catch (err) {
      logger.error("Failed to rate flashcard:", err);
      await interaction.update({ embeds: [], components: [], content: "Failed to record rating." });
    }
  }

  private async handleFlashcardNext(interaction: ButtonInteraction): Promise<void> {
    try {
      const card = await this.vocabEngine.getFlashcard({ userId: interaction.user.id });

      if (!card) {
        const nextDue = await this.vocabEngine.getNextDueDate(interaction.user.id);
        let message = "No words are due for review right now.";
        if (nextDue) {
          const diffMs = nextDue - Date.now();
          const diffHours = Math.round(diffMs / 3_600_000);
          const timeStr = diffHours < 24 ? `${diffHours} hour(s)` : `${Math.round(diffMs / 86_400_000)} day(s)`;
          message += `\nNext review in ${timeStr}.`;
        }
        await interaction.update({ embeds: [], components: [], content: message });
        return;
      }

      const embed = buildFlashcardFrontEmbed(card.word, card.language);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`vocab_fc_flip:${card.dailyWordId}`)
          .setLabel("Flip Card")
          .setStyle(ButtonStyle.Primary),
      );

      await interaction.update({ embeds: [embed], components: [row] });
    } catch (err) {
      logger.error("Failed to load next flashcard:", err);
      await interaction.update({ embeds: [], components: [], content: "Failed to load next card." });
    }
  }
}
