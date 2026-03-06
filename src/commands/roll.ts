import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import { DiceEngine } from "../engines/dice-engine.js";
import { formatDiceRoll } from "../utilities/shadowrun-format.js";

export function createRollCommand(diceEngine: DiceEngine): Command {
  return {
    name: "roll",
    description: "Roll Shadowrun dice",
    slashData: new SlashCommandBuilder()
      .setName("roll")
      .setDescription("Roll Shadowrun dice")
      .addIntegerOption((opt) =>
        opt.setName("pool").setDescription("Number of dice to roll").setRequired(true).setMinValue(1).setMaxValue(50),
      )
      .addIntegerOption((opt) =>
        opt.setName("limit").setDescription("Hit limit (optional)").setMinValue(1),
      )
      .addStringOption((opt) =>
        opt.setName("description").setDescription("What the roll is for (e.g., Firearms + Agility)"),
      )
      .addIntegerOption((opt) =>
        opt.setName("edge").setDescription("Edge dice to add (Push the Limit)").setMinValue(1).setMaxValue(7),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      const pool = interaction.options.getInteger("pool", true);
      const limit = interaction.options.getInteger("limit") ?? undefined;
      const description = interaction.options.getString("description") ?? `${pool}d6`;
      const edgeDice = interaction.options.getInteger("edge") ?? 0;

      const result = edgeDice > 0
        ? diceEngine.pushTheLimit(pool, edgeDice)
        : diceEngine.roll(pool, limit);

      const display = formatDiceRoll({
        characterName: interaction.user.displayName,
        description,
        result,
      });

      await interaction.reply(display);
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      const args = context.args;

      if (args.length === 0) {
        await message.reply("Usage: `!roll <pool> [limit] [description]` or `!roll edge <pool> <edge_dice>`");
        return;
      }

      if (args[0].toLowerCase() === "edge") {
        const pool = parseInt(args[1], 10);
        const edgeDice = parseInt(args[2], 10);
        if (isNaN(pool) || isNaN(edgeDice)) {
          await message.reply("Usage: `!roll edge <pool> <edge_dice>`");
          return;
        }

        const result = diceEngine.pushTheLimit(pool, edgeDice);
        const display = formatDiceRoll({
          characterName: message.author.displayName,
          description: `Push the Limit (${pool}+${edgeDice}d6)`,
          result,
        });
        await message.reply(display);
        return;
      }

      const pool = parseInt(args[0], 10);
      if (isNaN(pool) || pool < 1) {
        await message.reply("First argument must be a number (dice pool size).");
        return;
      }

      let limit: number | undefined;
      let descriptionParts: string[] = [];

      if (args.length > 1) {
        const maybeLimit = parseInt(args[1], 10);
        if (!isNaN(maybeLimit)) {
          limit = maybeLimit;
          descriptionParts = args.slice(2);
        } else {
          descriptionParts = args.slice(1);
        }
      }

      const description = descriptionParts.join(" ") || `${pool}d6`;
      const result = diceEngine.roll(pool, limit);
      const display = formatDiceRoll({
        characterName: message.author.displayName,
        description,
        result,
      });
      await message.reply(display);
    },
  };
}
