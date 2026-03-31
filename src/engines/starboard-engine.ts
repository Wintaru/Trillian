import { EmbedBuilder } from "discord.js";
import type { TextChannel, Message, MessageReaction, PartialMessageReaction } from "discord.js";
import type { StarboardAccessor } from "../accessors/starboard-accessor.js";
import * as logger from "../utilities/logger.js";

const STARBOARD_COLOR = 0xffac33; // gold

export class StarboardEngine {
  constructor(
    private readonly starboardAccessor: StarboardAccessor,
    private readonly threshold: number,
  ) {}

  async handleReactionUpdate(
    reaction: MessageReaction | PartialMessageReaction,
    starboardChannelId: string,
  ): Promise<void> {
    // Ensure reaction and message are fully fetched
    if (reaction.partial) {
      try {
        reaction = await reaction.fetch();
      } catch {
        logger.warn("Starboard: could not fetch partial reaction, skipping");
        return;
      }
    }

    // Only care about ⭐ reactions
    if (reaction.emoji.name !== "⭐") return;

    const message = reaction.message;
    if (!message.guild) return;

    // Ensure full message is fetched (for content, author, etc.)
    let fullMessage: Message;
    try {
      fullMessage = message.partial ? await message.fetch() : (message as Message);
    } catch {
      logger.warn("Starboard: could not fetch partial message, skipping");
      return;
    }

    // Don't starboard bot messages
    if (fullMessage.author.bot) return;

    const guildId = fullMessage.guild!.id;
    const starCount = reaction.count;

    // Get or create the DB entry
    const member = fullMessage.member ?? (await fullMessage.guild!.members.fetch(fullMessage.author.id).catch(() => null));
    const displayName = member?.displayName ?? fullMessage.author.displayName;

    const { entry } = await this.starboardAccessor.upsertEntry(
      guildId,
      fullMessage.id,
      fullMessage.channelId,
      fullMessage.author.id,
      displayName,
      fullMessage.content,
      starCount,
    );

    // Only interact with the starboard channel if threshold is met or message already posted
    if (starCount < this.threshold && !entry.starboardMessageId) {
      return;
    }

    const starboardChannel = await fullMessage.guild!.channels.fetch(starboardChannelId).catch(() => null);
    if (!starboardChannel?.isTextBased()) {
      logger.warn(`Starboard: channel ${starboardChannelId} not found or not text-based`);
      return;
    }

    const textChannel = starboardChannel as TextChannel;

    if (starCount >= this.threshold) {
      const embed = await this.buildStarboardEmbed(
        fullMessage,
        displayName,
        starCount,
      );
      const content = this.buildStarboardContent(starCount, fullMessage.channelId);

      if (entry.starboardMessageId) {
        // Update existing starboard message
        try {
          const starboardMessage = await textChannel.messages.fetch(entry.starboardMessageId);
          await starboardMessage.edit({ content, embeds: [embed] });
        } catch {
          // Starboard message was deleted — re-post
          const posted = await textChannel.send({ content, embeds: [embed] });
          await this.starboardAccessor.setStarboardMessageId(guildId, fullMessage.id, posted.id);
        }
      } else {
        // Post new starboard message
        const posted = await textChannel.send({ content, embeds: [embed] });
        await this.starboardAccessor.setStarboardMessageId(guildId, fullMessage.id, posted.id);
      }
    } else if (entry.starboardMessageId) {
      // Below threshold but already posted — update the count
      const embed = await this.buildStarboardEmbed(
        fullMessage,
        displayName,
        starCount,
      );
      const content = this.buildStarboardContent(starCount, fullMessage.channelId);

      try {
        const starboardMessage = await textChannel.messages.fetch(entry.starboardMessageId);
        await starboardMessage.edit({ content, embeds: [embed] });
      } catch {
        // Starboard message was deleted — don't re-post since below threshold
      }
    }
  }

  private buildStarboardContent(starCount: number, channelId: string): string {
    return `⭐ **${starCount}** <#${channelId}>`;
  }

  private async buildStarboardEmbed(
    message: Message,
    authorDisplayName: string,
    starCount: number,
  ): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
      .setColor(STARBOARD_COLOR)
      .setAuthor({
        name: authorDisplayName,
        iconURL: message.author.displayAvatarURL(),
      })
      .setTimestamp(message.createdAt);

    // Build description with quoted reply context if present
    let description = "";
    if (message.reference?.messageId) {
      try {
        const channel = message.channel;
        const referencedMessage = await channel.messages.fetch(message.reference.messageId);
        const refMember = referencedMessage.member
          ?? await message.guild!.members.fetch(referencedMessage.author.id).catch(() => null);
        const refName = refMember?.displayName ?? referencedMessage.author.displayName;
        const refContent = referencedMessage.content || "*[no text content]*";
        // Format as blockquote with author name
        const quotedLines = refContent.split("\n").map((line: string) => `> ${line}`).join("\n");
        description += `**${refName}:**\n${quotedLines}\n\n`;
      } catch {
        // Referenced message was deleted — skip the quote
      }
    }

    if (message.content) {
      description += message.content;
    }

    if (description) {
      embed.setDescription(description);
    }

    // Add image if the message has an attachment
    const imageAttachment = message.attachments.find((a) =>
      a.contentType?.startsWith("image/"),
    );
    if (imageAttachment) {
      embed.setImage(imageAttachment.url);
    }

    const messageLink = `https://discord.com/channels/${message.guild!.id}/${message.channelId}/${message.id}`;

    embed.addFields({
      name: "Source",
      value: `[Jump!](${messageLink})`,
    });

    embed.setFooter({ text: message.id });

    return embed;
  }
}
