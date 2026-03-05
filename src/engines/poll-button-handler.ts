import type { ButtonInteraction } from "discord.js";
import type { ButtonHandler } from "../types/button-handler.js";
import type { PollEngine } from "./poll-engine.js";
import { buildPollEmbed } from "../utilities/poll-embed.js";
import * as logger from "../utilities/logger.js";

export class PollButtonHandler implements ButtonHandler {
  constructor(private pollEngine: PollEngine) {}

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    if (customId.startsWith("poll_vote:")) {
      await this.handleVote(interaction);
    } else if (customId.startsWith("poll_close:")) {
      await this.handleClose(interaction);
    }
  }

  private async handleVote(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(":");
    const pollId = parseInt(parts[1], 10);
    const optionIndex = parseInt(parts[2], 10);

    const result = await this.pollEngine.castVote({
      pollId,
      userId: interaction.user.id,
      optionIndex,
    });

    if (!result.success) {
      await interaction.reply({
        content: `Could not record vote: ${result.reason.replace(/_/g, " ")}.`,
        flags: 64,
      });
      return;
    }

    const message =
      result.reason === "changed"
        ? "Your vote has been changed!"
        : "Your vote has been recorded!";

    await interaction.reply({ content: message, flags: 64 });

    try {
      const results = await this.pollEngine.getPollResults({ pollId });
      if (results) {
        await interaction.message.edit({ embeds: [buildPollEmbed(results)] });
      }
    } catch (err) {
      logger.error(`Failed to update poll embed for poll ${pollId}:`, err);
    }
  }

  private async handleClose(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(":");
    const pollId = parseInt(parts[1], 10);

    const isAdmin = interaction.memberPermissions?.has("Administrator") ?? false;

    const result = await this.pollEngine.closePoll({
      pollId,
      requesterId: interaction.user.id,
      isAdmin,
    });

    if (!result.success) {
      await interaction.reply({
        content: `Cannot close poll: ${result.reason.replace(/_/g, " ")}.`,
        flags: 64,
      });
      return;
    }

    await interaction.reply({ content: "Poll closed!", flags: 64 });

    try {
      if (result.results) {
        await interaction.message.edit({
          embeds: [buildPollEmbed(result.results)],
          components: [],
        });
      }
    } catch (err) {
      logger.error(`Failed to update closed poll embed for poll ${pollId}:`, err);
    }
  }
}
