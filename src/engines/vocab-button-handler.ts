import type { ButtonInteraction } from "discord.js";
import type { ButtonHandler } from "../types/button-handler.js";
import type { VocabEngine } from "./vocab-engine.js";
import * as logger from "../utilities/logger.js";

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
}
