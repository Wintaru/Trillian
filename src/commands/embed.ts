import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from "discord.js";
import type { ChatInputCommandInteraction, Message, TextChannel, APIEmbed } from "discord.js";
import type { EmbedState, EmbedField } from "../types/embed-contracts.js";
import type { Command, CommandContext } from "../types/command.js";
import type { EmbedEngine } from "../engines/embed-engine.js";
import { buildWizardMessage } from "../utilities/embed-preview.js";

export function createEmbedCommand(embedEngine: EmbedEngine): Command {
  return {
    name: "embed",
    description: "Create and manage custom embeds",
    slashData: new SlashCommandBuilder()
      .setName("embed")
      .setDescription("Create and manage custom embeds")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addSubcommand((sub) =>
        sub.setName("create").setDescription("Open the embed builder wizard"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("edit")
          .setDescription("Edit an existing bot-posted embed")
          .addStringOption((opt) =>
            opt.setName("message_id").setDescription("The message ID to edit").setRequired(true),
          )
          .addChannelOption((opt) =>
            opt
              .setName("channel")
              .setDescription("The channel the message is in (defaults to current channel)")
              .addChannelTypes(ChannelType.GuildText),
          ),
      )
      .addSubcommandGroup((group) =>
        group
          .setName("template")
          .setDescription("Manage embed templates")
          .addSubcommand((sub) =>
            sub
              .setName("list")
              .setDescription("List your saved embed templates"),
          )
          .addSubcommand((sub) =>
            sub
              .setName("load")
              .setDescription("Load a template into the embed builder")
              .addStringOption((opt) =>
                opt.setName("name").setDescription("Template name").setRequired(true),
              ),
          )
          .addSubcommand((sub) =>
            sub
              .setName("delete")
              .setDescription("Delete a saved template")
              .addStringOption((opt) =>
                opt.setName("name").setDescription("Template name").setRequired(true),
              ),
          ),
      ),

    async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
      if (!interaction.guildId || !interaction.channelId) {
        await interaction.reply({
          content: "This command can only be used in a server.",
          flags: 64,
        });
        return;
      }

      const subcommandGroup = interaction.options.getSubcommandGroup();
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "create") {
        const { sessionId, state } = embedEngine.createSession({
          userId: interaction.user.id,
          guildId: interaction.guildId,
          channelId: interaction.channelId,
        });

        const message = buildWizardMessage(sessionId, state);
        await interaction.reply({ ...message, flags: 64 });
        return;
      }

      if (subcommand === "edit") {
        const messageId = interaction.options.getString("message_id", true);
        const targetChannel = interaction.options.getChannel("channel") as TextChannel | null;
        const channelId = targetChannel?.id ?? interaction.channelId;

        try {
          const channel = await interaction.client.channels.fetch(channelId);
          if (!channel || channel.type !== ChannelType.GuildText) {
            await interaction.reply({ content: "Could not find that text channel.", flags: 64 });
            return;
          }

          const msg = await (channel as TextChannel).messages.fetch(messageId);
          if (msg.author.id !== interaction.client.user?.id) {
            await interaction.reply({
              content: "I can only edit embeds from messages I sent.",
              flags: 64,
            });
            return;
          }

          const existingEmbed = msg.embeds[0];
          if (!existingEmbed) {
            await interaction.reply({ content: "That message has no embeds.", flags: 64 });
            return;
          }

          const initialState = extractEmbedState(existingEmbed.toJSON());
          const { sessionId, state } = embedEngine.createSession({
            userId: interaction.user.id,
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            initialState,
            editingMessageId: messageId,
            editingChannelId: channelId,
          });

          const message = buildWizardMessage(sessionId, state);
          await interaction.reply({ ...message, flags: 64 });
        } catch {
          await interaction.reply({
            content: "Could not fetch that message. Check the message ID and channel.",
            flags: 64,
          });
        }
        return;
      }

      if (subcommandGroup === "template") {
        switch (subcommand) {
          case "list": {
            const result = await embedEngine.listTemplates({
              guildId: interaction.guildId,
              userId: interaction.user.id,
            });

            if (result.templates.length === 0) {
              await interaction.reply({
                content: "You have no saved templates. Use the embed builder's **Save Template** button to create one.",
                flags: 64,
              });
              return;
            }

            const lines = result.templates.map(
              (t) => `- **${t.name}** (updated <t:${Math.floor(t.updatedAt / 1000)}:R>)`,
            );

            const listEmbed = new EmbedBuilder()
              .setTitle("Your Embed Templates")
              .setDescription(lines.join("\n"))
              .setColor(0x5865f2)
              .setFooter({ text: `${result.templates.length}/25 templates` });

            await interaction.reply({ embeds: [listEmbed], flags: 64 });
            return;
          }
          case "load": {
            const name = interaction.options.getString("name", true);
            const result = await embedEngine.loadTemplate({
              guildId: interaction.guildId,
              userId: interaction.user.id,
              name,
            });

            if (!result.success || !result.state) {
              await interaction.reply({
                content: `Template "${name}" not found.`,
                flags: 64,
              });
              return;
            }

            const { sessionId, state } = embedEngine.createSession({
              userId: interaction.user.id,
              guildId: interaction.guildId,
              channelId: interaction.channelId,
              initialState: result.state,
            });

            const message = buildWizardMessage(sessionId, state);
            await interaction.reply({ ...message, flags: 64 });
            return;
          }
          case "delete": {
            const name = interaction.options.getString("name", true);
            const result = await embedEngine.deleteTemplate({
              guildId: interaction.guildId,
              userId: interaction.user.id,
              name,
            });

            if (!result.success) {
              await interaction.reply({
                content: `Template "${name}" not found.`,
                flags: 64,
              });
              return;
            }

            await interaction.reply({
              content: `Template "${name}" deleted.`,
              flags: 64,
            });
            return;
          }
        }
      }
    },

    async executePrefix(message: Message, _context: CommandContext): Promise<void> {
      await message.reply(
        "The embed builder requires interactive components. Please use the `/embed` slash command instead.",
      );
    },
  };
}

function extractEmbedState(embed: APIEmbed): EmbedState {
  const fields: EmbedField[] = (embed.fields ?? []).map((f) => ({
    name: f.name,
    value: f.value,
    inline: f.inline ?? false,
  }));

  return {
    title: embed.title,
    description: embed.description,
    color: embed.color,
    url: embed.url,
    fields,
    imageUrl: embed.image?.url,
    thumbnailUrl: embed.thumbnail?.url,
    footerText: embed.footer?.text,
    footerIconUrl: embed.footer?.icon_url,
    authorName: embed.author?.name,
    authorIconUrl: embed.author?.icon_url,
    authorUrl: embed.author?.url,
  };
}
