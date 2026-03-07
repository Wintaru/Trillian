import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { EmbedState } from "../types/embed-contracts.js";

const MAX_FIELDS = 25;

export function buildPreviewEmbed(state: EmbedState): EmbedBuilder {
  const embed = new EmbedBuilder();

  if (state.title) embed.setTitle(state.title);
  if (state.description) embed.setDescription(state.description);
  if (state.color !== undefined) embed.setColor(state.color);
  if (state.url) embed.setURL(state.url);
  if (state.imageUrl) embed.setImage(state.imageUrl);
  if (state.thumbnailUrl) embed.setThumbnail(state.thumbnailUrl);

  if (state.footerText) {
    embed.setFooter({
      text: state.footerText,
      iconURL: state.footerIconUrl,
    });
  }

  if (state.authorName) {
    embed.setAuthor({
      name: state.authorName,
      iconURL: state.authorIconUrl,
      url: state.authorUrl,
    });
  }

  for (const field of state.fields) {
    embed.addFields({ name: field.name, value: field.value, inline: field.inline });
  }

  return embed;
}

export function isEmbedEmpty(state: EmbedState): boolean {
  return (
    !state.title &&
    !state.description &&
    !state.imageUrl &&
    !state.thumbnailUrl &&
    !state.footerText &&
    !state.authorName &&
    state.fields.length === 0
  );
}

export function buildWizardButtons(
  sessionId: string,
  state: EmbedState,
): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`embed_title:${sessionId}`)
      .setLabel("Set Title")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`embed_desc:${sessionId}`)
      .setLabel("Set Description")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`embed_color:${sessionId}`)
      .setLabel("Set Color")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`embed_field:${sessionId}`)
      .setLabel("Add Field")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.fields.length >= MAX_FIELDS),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`embed_image:${sessionId}`)
      .setLabel("Set Image")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`embed_footer:${sessionId}`)
      .setLabel("Set Footer")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`embed_author:${sessionId}`)
      .setLabel("Set Author")
      .setStyle(ButtonStyle.Secondary),
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`embed_send:${sessionId}`)
      .setLabel("Send to Channel")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`embed_save:${sessionId}`)
      .setLabel("Save Template")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`embed_cancel:${sessionId}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2, row3];
}

export function buildWizardMessage(
  sessionId: string,
  state: EmbedState,
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const preview = buildPreviewEmbed(state);

  if (isEmbedEmpty(state)) {
    preview.setDescription("*Empty embed — use the buttons below to add content.*");
    preview.setColor(0x5865f2);
  }

  return {
    embeds: [preview],
    components: buildWizardButtons(sessionId, state),
  };
}
