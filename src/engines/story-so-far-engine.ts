import type { GuildTextBasedChannel, Message } from "discord.js";
import type { OllamaAccessor, OllamaChatMessage } from "../accessors/ollama-accessor.js";
import type { ChannelAccessor } from "../accessors/channel-accessor.js";
import * as logger from "../utilities/logger.js";

const MAX_MESSAGES = 500;
const FALLBACK_LIMIT = 100;
const MAX_TOKENS = 6000;
const CHARS_PER_TOKEN = 4;

const SYSTEM_PROMPT = `You are summarizing a Discord chat conversation for someone who missed it. Write a concise, neutral summary that:
- Preserves who said what (use their display names)
- Captures the key topics, decisions, and highlights
- Notes any media that was shared (images, links, files) with context about what they were
- Groups related discussion together rather than going message-by-message
- Keeps a casual, readable tone — this is a chat summary, not a formal report

Do NOT include a title or heading. Jump straight into the summary.`;

const FALLBACK_MESSAGE =
  "I wasn't able to generate a summary right now. Try again in a moment!";

export interface MediaReference {
  url: string;
  messageUrl: string;
  description: string;
}

export interface StorySoFarResult {
  summary: string;
  messageCount: number;
  mediaReferences: MediaReference[];
  truncated: boolean;
}

export class StorySoFarEngine {
  private readonly ollamaAccessor: OllamaAccessor;
  private readonly channelAccessor: ChannelAccessor;

  constructor(ollamaAccessor: OllamaAccessor, channelAccessor: ChannelAccessor) {
    this.ollamaAccessor = ollamaAccessor;
    this.channelAccessor = channelAccessor;
  }

  async summarize(
    channel: GuildTextBasedChannel,
    userId: string,
  ): Promise<StorySoFarResult> {
    const messages = await this.channelAccessor.fetchMessagesUntilUser(
      channel,
      userId,
      MAX_MESSAGES,
    );

    if (messages.length === 0) {
      const fallbackBatch = await this.channelAccessor.fetchMessages(channel, FALLBACK_LIMIT);
      const sorted = [...fallbackBatch.values()].reverse();
      if (sorted.length === 0) {
        return {
          summary: "There aren't any messages in this channel yet!",
          messageCount: 0,
          mediaReferences: [],
          truncated: false,
        };
      }
      return this.buildSummary(sorted, channel);
    }

    return this.buildSummary(messages, channel);
  }

  private async buildSummary(
    messages: Message<true>[],
    channel: GuildTextBasedChannel,
  ): Promise<StorySoFarResult> {
    const mediaReferences = this.extractMedia(messages, channel);
    const { transcript, truncated } = this.formatTranscript(messages);

    const ollamaMessages: OllamaChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ];

    let summary: string;
    try {
      summary = await this.ollamaAccessor.chat(ollamaMessages);
    } catch (error) {
      logger.error("Story-so-far Ollama call failed:", error);
      summary = FALLBACK_MESSAGE;
    }

    return {
      summary,
      messageCount: messages.length,
      mediaReferences,
      truncated,
    };
  }

  private formatTranscript(messages: Message<true>[]): {
    transcript: string;
    truncated: boolean;
  } {
    const lines: string[] = [];
    for (const msg of messages) {
      const name = msg.member?.displayName ?? msg.author.displayName;
      let line = `[${name}]: ${msg.content}`;

      for (const attachment of msg.attachments.values()) {
        line += ` [Attachment: ${attachment.name}]`;
      }
      for (const embed of msg.embeds) {
        if (embed.image) line += ` [Image]`;
        if (embed.url) line += ` [Link: ${embed.url}]`;
      }

      lines.push(line);
    }

    const maxChars = MAX_TOKENS * CHARS_PER_TOKEN;
    let joined = lines.join("\n");

    if (joined.length <= maxChars) {
      return { transcript: joined, truncated: false };
    }

    // Truncate from the start (oldest) to keep the most recent conversation
    while (lines.length > 1 && joined.length > maxChars) {
      lines.shift();
      joined = lines.join("\n");
    }

    return {
      transcript: `[Earlier messages were trimmed for length]\n${joined}`,
      truncated: true,
    };
  }

  private extractMedia(
    messages: Message<true>[],
    channel: GuildTextBasedChannel,
  ): MediaReference[] {
    const refs: MediaReference[] = [];
    const guildId = channel.guildId;

    for (const msg of messages) {
      const messageUrl = `https://discord.com/channels/${guildId}/${channel.id}/${msg.id}`;

      for (const attachment of msg.attachments.values()) {
        refs.push({
          url: attachment.url,
          messageUrl,
          description: attachment.name ?? "attachment",
        });
      }

      const urlPattern = /https?:\/\/[^\s<>]+/g;
      const urls = msg.content.match(urlPattern);
      if (urls) {
        for (const url of urls) {
          refs.push({ url, messageUrl, description: "link" });
        }
      }
    }

    return refs;
  }
}
