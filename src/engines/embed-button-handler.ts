import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
} from "discord.js";
import type {
  ButtonInteraction,
  ModalSubmitInteraction,
  TextChannel,
} from "discord.js";
import type { ButtonHandler, ModalHandler } from "../types/button-handler.js";
import type { EmbedEngine } from "./embed-engine.js";
import type { EmbedFieldName, EmbedState } from "../types/embed-contracts.js";
import { buildPreviewEmbed, buildWizardMessage } from "../utilities/embed-preview.js";
import * as logger from "../utilities/logger.js";

function parseSessionId(customId: string): string {
  return customId.split(":").slice(1).join(":");
}

function modalField(
  id: string,
  label: string,
  style: TextInputStyle,
  options?: { required?: boolean; placeholder?: string; value?: string; maxLength?: number },
): ActionRowBuilder<TextInputBuilder> {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style)
    .setRequired(options?.required ?? false);

  if (options?.placeholder) input.setPlaceholder(options.placeholder);
  if (options?.value) input.setValue(options.value);
  if (options?.maxLength) input.setMaxLength(options.maxLength);

  return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
}

async function updateWizard(
  interaction: ModalSubmitInteraction,
  sessionId: string,
  state: EmbedState,
): Promise<void> {
  const message = buildWizardMessage(sessionId, state);
  if (interaction.isFromMessage()) {
    await interaction.update({
      embeds: message.embeds,
      components: message.components,
    });
  } else {
    await interaction.reply({
      ...message,
      flags: 64,
    });
  }
}

export class EmbedButtonHandler implements ButtonHandler, ModalHandler {
  constructor(private embedEngine: EmbedEngine) {}

  canHandle(customId: string): boolean {
    return customId.startsWith("embed_");
  }

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;
    const sessionId = parseSessionId(customId);
    const session = this.embedEngine.getSession(sessionId, interaction.user.id);

    if (!session) {
      await interaction.reply({
        content: "This embed session has expired. Please create a new one with `/embed create`.",
        flags: 64,
      });
      return;
    }

    if (customId.startsWith("embed_cancel:")) {
      await this.handleCancel(interaction, sessionId);
      return;
    }

    if (customId.startsWith("embed_send:")) {
      await this.showSendModal(interaction, sessionId);
      return;
    }

    if (customId.startsWith("embed_save:")) {
      await this.showSaveModal(interaction, sessionId);
      return;
    }

    const action = customId.split(":")[0].replace("embed_", "");
    await this.showFieldModal(interaction, sessionId, action, session.state);
  }

  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = interaction.customId;
    const sessionId = parseSessionId(customId);

    if (customId.startsWith("embed_modal_send:")) {
      await this.handleSend(interaction, sessionId);
      return;
    }

    if (customId.startsWith("embed_modal_save:")) {
      await this.handleSave(interaction, sessionId);
      return;
    }

    if (customId.startsWith("embed_modal_field:")) {
      await this.handleAddField(interaction, sessionId);
      return;
    }

    const fieldName = customId.split(":")[0].replace("embed_modal_", "") as EmbedFieldName;
    await this.handleFieldUpdate(interaction, sessionId, fieldName);
  }

  private async showFieldModal(
    interaction: ButtonInteraction,
    sessionId: string,
    action: string,
    state: EmbedState,
  ): Promise<void> {
    const modal = new ModalBuilder().setCustomId(`embed_modal_${action}:${sessionId}`);

    switch (action) {
      case "title":
        modal.setTitle("Set Title");
        modal.addComponents(
          modalField("title", "Title", TextInputStyle.Short, {
            maxLength: 256,
            value: state.title,
            placeholder: "Enter embed title",
          }),
        );
        break;
      case "desc":
        modal.setTitle("Set Description");
        modal.addComponents(
          modalField("description", "Description", TextInputStyle.Paragraph, {
            maxLength: 4096,
            value: state.description,
            placeholder: "Enter embed description (supports markdown)",
          }),
        );
        break;
      case "color":
        modal.setTitle("Set Color");
        modal.addComponents(
          modalField("color", "Color (hex code)", TextInputStyle.Short, {
            maxLength: 7,
            value: state.color !== undefined
              ? `#${state.color.toString(16).padStart(6, "0")}`
              : undefined,
            placeholder: "#FF5733",
          }),
        );
        break;
      case "image":
        modal.setTitle("Set Images");
        modal.addComponents(
          modalField("imageUrl", "Image URL", TextInputStyle.Short, {
            value: state.imageUrl,
            placeholder: "https://example.com/image.png",
          }),
          modalField("thumbnailUrl", "Thumbnail URL", TextInputStyle.Short, {
            value: state.thumbnailUrl,
            placeholder: "https://example.com/thumbnail.png",
          }),
        );
        break;
      case "footer":
        modal.setTitle("Set Footer");
        modal.addComponents(
          modalField("footerText", "Footer Text", TextInputStyle.Short, {
            maxLength: 2048,
            value: state.footerText,
            placeholder: "Footer text",
          }),
          modalField("footerIconUrl", "Footer Icon URL", TextInputStyle.Short, {
            value: state.footerIconUrl,
            placeholder: "https://example.com/icon.png",
          }),
        );
        break;
      case "author":
        modal.setTitle("Set Author");
        modal.addComponents(
          modalField("authorName", "Author Name", TextInputStyle.Short, {
            maxLength: 256,
            value: state.authorName,
            placeholder: "Author name",
          }),
          modalField("authorIconUrl", "Author Icon URL", TextInputStyle.Short, {
            value: state.authorIconUrl,
            placeholder: "https://example.com/icon.png",
          }),
          modalField("authorUrl", "Author URL", TextInputStyle.Short, {
            value: state.authorUrl,
            placeholder: "https://example.com",
          }),
        );
        break;
      case "field":
        modal.setTitle("Add Field");
        modal.addComponents(
          modalField("fieldName", "Field Name", TextInputStyle.Short, {
            required: true,
            maxLength: 256,
            placeholder: "Field title",
          }),
          modalField("fieldValue", "Field Value", TextInputStyle.Paragraph, {
            required: true,
            maxLength: 1024,
            placeholder: "Field content",
          }),
          modalField("fieldInline", "Inline? (yes/no)", TextInputStyle.Short, {
            placeholder: "no",
          }),
        );
        break;
      default:
        return;
    }

    await interaction.showModal(modal);
  }

  private async handleFieldUpdate(
    interaction: ModalSubmitInteraction,
    sessionId: string,
    fieldName: EmbedFieldName,
  ): Promise<void> {
    const values: Record<string, string> = {};
    for (const [, row] of interaction.fields.fields) {
      if (row.type === 4) {
        values[row.customId] = row.value;
      }
    }

    const resolvedField = fieldName === ("desc" as EmbedFieldName) ? "description" : fieldName;
    const state = this.embedEngine.updateField({
      sessionId,
      userId: interaction.user.id,
      field: resolvedField as EmbedFieldName,
      values,
    });

    if (!state) {
      await interaction.reply({
        content: "Session expired. Please create a new embed with `/embed create`.",
        flags: 64,
      });
      return;
    }

    await updateWizard(interaction, sessionId, state);
  }

  private async showSendModal(
    interaction: ButtonInteraction,
    sessionId: string,
  ): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(`embed_modal_send:${sessionId}`)
      .setTitle("Send Embed")
      .addComponents(
        modalField("channelId", "Channel ID or #channel mention", TextInputStyle.Short, {
          required: true,
          placeholder: "Paste the channel ID or #channel-name",
        }),
      );

    await interaction.showModal(modal);
  }

  private async handleSend(
    interaction: ModalSubmitInteraction,
    sessionId: string,
  ): Promise<void> {
    const session = this.embedEngine.getSession(sessionId, interaction.user.id);
    if (!session) {
      await interaction.reply({
        content: "Session expired. Please create a new embed with `/embed create`.",
        flags: 64,
      });
      return;
    }

    const validation = this.embedEngine.validateSend({
      sessionId,
      userId: interaction.user.id,
      targetChannelId: "",
    });

    if (!validation.success) {
      await interaction.reply({
        content: `Cannot send: ${validation.reason.replace(/_/g, " ")}.`,
        flags: 64,
      });
      return;
    }

    const rawChannel = interaction.fields.getTextInputValue("channelId").trim();
    const channelId = rawChannel.replace(/[<#>]/g, "");

    try {
      const channel = await interaction.client.channels.fetch(channelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: "Could not find that text channel. Please provide a valid channel ID.",
          flags: 64,
        });
        return;
      }

      const textChannel = channel as TextChannel;
      const embed = buildPreviewEmbed(session.state);

      if (session.editingMessageId && session.editingChannelId) {
        try {
          const editChannel = await interaction.client.channels.fetch(session.editingChannelId);
          if (editChannel && editChannel.type === ChannelType.GuildText) {
            const msg = await (editChannel as TextChannel).messages.fetch(session.editingMessageId);
            await msg.edit({ embeds: [embed] });

            if (interaction.isFromMessage()) {
              await interaction.update({
                content: "Embed updated successfully!",
                embeds: [],
                components: [],
              });
            } else {
              await interaction.reply({ content: "Embed updated successfully!", flags: 64 });
            }
            this.embedEngine.destroySession(sessionId);
            return;
          }
        } catch (err) {
          logger.error("Failed to edit existing embed, sending as new:", err);
        }
      }

      await textChannel.send({ embeds: [embed] });

      if (interaction.isFromMessage()) {
        await interaction.update({
          content: `Embed sent to <#${textChannel.id}>!`,
          embeds: [],
          components: [],
        });
      } else {
        await interaction.reply({
          content: `Embed sent to <#${textChannel.id}>!`,
          flags: 64,
        });
      }
      this.embedEngine.destroySession(sessionId);
    } catch (err) {
      logger.error("Failed to send embed:", err);
      await interaction.reply({
        content: "Failed to send the embed. Check the channel ID and bot permissions.",
        flags: 64,
      });
    }
  }

  private async handleAddField(
    interaction: ModalSubmitInteraction,
    sessionId: string,
  ): Promise<void> {
    const name = interaction.fields.getTextInputValue("fieldName");
    const value = interaction.fields.getTextInputValue("fieldValue");
    const inlineVal = interaction.fields.getTextInputValue("fieldInline").toLowerCase();
    const inline = inlineVal === "yes" || inlineVal === "true" || inlineVal === "y";

    const state = this.embedEngine.addField({
      sessionId,
      userId: interaction.user.id,
      name,
      value,
      inline,
    });

    if (!state) {
      await interaction.reply({
        content: "Session expired. Please create a new embed with `/embed create`.",
        flags: 64,
      });
      return;
    }

    await updateWizard(interaction, sessionId, state);
  }

  private async showSaveModal(
    interaction: ButtonInteraction,
    sessionId: string,
  ): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(`embed_modal_save:${sessionId}`)
      .setTitle("Save as Template")
      .addComponents(
        modalField("templateName", "Template Name", TextInputStyle.Short, {
          required: true,
          maxLength: 50,
          placeholder: "my-announcement",
        }),
      );

    await interaction.showModal(modal);
  }

  private async handleSave(
    interaction: ModalSubmitInteraction,
    sessionId: string,
  ): Promise<void> {
    const session = this.embedEngine.getSession(sessionId, interaction.user.id);
    if (!session) {
      await interaction.reply({
        content: "Session expired. Please create a new embed with `/embed create`.",
        flags: 64,
      });
      return;
    }

    const templateName = interaction.fields.getTextInputValue("templateName").trim();
    const result = await this.embedEngine.saveTemplate({
      guildId: session.guildId,
      userId: interaction.user.id,
      name: templateName,
      state: session.state,
    });

    if (!result.success) {
      const messages: Record<string, string> = {
        name_too_long: "Template name is too long (max 50 characters).",
        too_many_templates: "You have reached the maximum number of templates (25).",
      };
      await interaction.reply({
        content: messages[result.reason] ?? "Failed to save template.",
        flags: 64,
      });
      return;
    }

    const verb = result.reason === "updated" ? "updated" : "saved";
    await interaction.reply({
      content: `Template "${templateName}" ${verb} successfully!`,
      flags: 64,
    });
  }

  private async handleCancel(
    interaction: ButtonInteraction,
    sessionId: string,
  ): Promise<void> {
    this.embedEngine.destroySession(sessionId);
    await interaction.update({
      content: "Embed builder cancelled.",
      embeds: [],
      components: [],
    });
  }
}
