import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { Command, CommandContext } from "../types/command.js";
import type { PollEngine } from "../engines/poll-engine.js";
import { buildPollEmbed } from "../utilities/poll-embed.js";

function buildPollButtons(
  pollId: number,
  options: string[],
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  for (let i = 0; i < options.length; i++) {
    if (currentRow.components.length === 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`poll_vote:${pollId}:${i}`)
        .setLabel(options[i].slice(0, 80))
        .setStyle(ButtonStyle.Primary),
    );
  }

  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`poll_close:${pollId}`)
      .setLabel("Close Poll")
      .setStyle(ButtonStyle.Danger),
  );
  rows.push(closeRow);

  return rows;
}

function parseOptions(input: string): string[] {
  return input
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

export function createPollCommand(pollEngine: PollEngine): Command {
  return {
    name: "poll",
    description: "Create an anonymous poll",
    slashData: new SlashCommandBuilder()
      .setName("poll")
      .setDescription("Create an anonymous poll")
      .addStringOption((opt) =>
        opt.setName("question").setDescription("The poll question").setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("options")
          .setDescription("Comma-separated options (2-10)")
          .setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName("duration")
          .setDescription("Duration in minutes (default: 480 = 8 hours)")
          .setMinValue(1)
          .setMaxValue(10080),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      if (!interaction.guildId || !interaction.channelId) {
        await interaction.reply({
          content: "This command can only be used in a server.",
          flags: 64,
        });
        return;
      }

      const question = interaction.options.getString("question", true);
      const optionsRaw = interaction.options.getString("options", true);
      const duration = interaction.options.getInteger("duration") ?? null;
      const options = parseOptions(optionsRaw);

      if (options.length < 2 || options.length > 10) {
        await interaction.reply({
          content: "Please provide between 2 and 10 comma-separated options.",
          flags: 64,
        });
        return;
      }

      const result = await pollEngine.createPoll({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        creatorId: interaction.user.id,
        question,
        options,
        durationMinutes: duration,
      });

      const pollResults = {
        pollId: result.pollId,
        question: result.question,
        options: result.options,
        voteCounts: new Array<number>(options.length).fill(0),
        totalVotes: 0,
        status: "open" as const,
        closesAt: result.closesAt,
      };

      const embed = buildPollEmbed(pollResults);
      const buttons = buildPollButtons(result.pollId, result.options);

      const reply = await interaction.reply({
        embeds: [embed],
        components: buttons,
        fetchReply: true,
      });

      await pollEngine.setPollMessageId(result.pollId, reply.id);
    },

    async executePrefix(message: Message, context: CommandContext): Promise<void> {
      if (!message.guild || !message.channelId) {
        await message.reply("This command can only be used in a server.");
        return;
      }

      const fullArgs = context.args.join(" ");
      const quoted = [...fullArgs.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

      if (quoted.length < 2) {
        await message.reply(
          'Usage: `!poll "Your question" "Option 1, Option 2, Option 3" [duration_minutes]`',
        );
        return;
      }

      const question = quoted[0];
      const options = parseOptions(quoted[1]);
      const remaining = fullArgs.replace(/"[^"]*"/g, "").trim();
      const durationMatch = remaining.match(/\d+/);
      const duration = durationMatch ? parseInt(durationMatch[0], 10) : null;

      if (options.length < 2 || options.length > 10) {
        await message.reply("Please provide between 2 and 10 comma-separated options.");
        return;
      }

      const result = await pollEngine.createPoll({
        guildId: message.guild.id,
        channelId: message.channelId,
        creatorId: message.author.id,
        question,
        options,
        durationMinutes: duration,
      });

      const pollResults = {
        pollId: result.pollId,
        question: result.question,
        options: result.options,
        voteCounts: new Array<number>(options.length).fill(0),
        totalVotes: 0,
        status: "open" as const,
        closesAt: result.closesAt,
      };

      const embed = buildPollEmbed(pollResults);
      const buttons = buildPollButtons(result.pollId, result.options);

      const reply = await message.reply({
        embeds: [embed],
        components: buttons,
      });

      await pollEngine.setPollMessageId(result.pollId, reply.id);
    },
  };
}
