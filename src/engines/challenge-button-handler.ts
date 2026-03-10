import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import type { ButtonHandler, ModalHandler } from "../types/button-handler.js";
import type { ChallengeEngine } from "./challenge-engine.js";
import { buildGradeEmbed, buildResultsEmbed } from "../utilities/challenge-embed.js";
import * as logger from "../utilities/logger.js";

export class ChallengeButtonHandler implements ButtonHandler, ModalHandler {
  constructor(private readonly challengeEngine: ChallengeEngine) {}

  canHandle(customId: string): boolean {
    return customId.startsWith("challenge_");
  }

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    if (customId.startsWith("challenge_submit:")) {
      await this.showSubmitModal(interaction);
    } else if (customId.startsWith("challenge_results:")) {
      await this.handleResults(interaction);
    }
  }

  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = interaction.customId;

    if (customId.startsWith("challenge_modal_submit:")) {
      await this.handleSubmission(interaction);
    }
  }

  private async showSubmitModal(interaction: ButtonInteraction): Promise<void> {
    const challengeId = interaction.customId.split(":")[1];

    const modal = new ModalBuilder()
      .setCustomId(`challenge_modal_submit:${challengeId}`)
      .setTitle("Submit Translation")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("translation_input")
            .setLabel("Your Translation")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Enter your translation here...")
            .setRequired(true)
            .setMaxLength(2000),
        ),
      );

    await interaction.showModal(modal);
  }

  private async handleSubmission(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ flags: 64 });

    const challengeId = parseInt(interaction.customId.split(":")[1], 10);
    const translation = interaction.fields.getTextInputValue("translation_input").trim();

    if (!translation) {
      await interaction.editReply("Please provide a translation.");
      return;
    }

    try {
      const result = await this.challengeEngine.submitTranslation({
        challengeId,
        userId: interaction.user.id,
        translation,
      });

      if (!result.success) {
        const messages: Record<string, string> = {
          challenge_not_found: "This challenge was not found.",
          challenge_closed: "This challenge has already closed.",
        };
        await interaction.editReply(messages[result.reason] ?? "Failed to submit translation.");
        return;
      }

      const label = result.reason === "resubmitted" ? "Translation updated!" : "Translation submitted!";

      if (result.grade) {
        const embed = buildGradeEmbed(result.grade, translation);
        embed.setTitle(label);
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply(label);
      }
    } catch (err) {
      logger.error("Failed to submit challenge translation:", err);
      await interaction.editReply("An error occurred while grading your translation. Please try again.");
    }
  }

  private async handleResults(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: 64 });

    const challengeId = parseInt(interaction.customId.split(":")[1], 10);

    try {
      const results = await this.challengeEngine.getResults({ challengeId });
      if (!results) {
        await interaction.editReply("Challenge not found.");
        return;
      }

      const embed = buildResultsEmbed(results);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error("Failed to load challenge results:", err);
      await interaction.editReply("An error occurred loading results.");
    }
  }
}
