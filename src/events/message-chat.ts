import { ChannelType } from "discord.js";
import type { EventHandler } from "../types/event.js";
import type { ChatEngine, ChannelMessage } from "../engines/chat-engine.js";
import * as logger from "../utilities/logger.js";

export function createMessageChatHandler(
  chatEngine: ChatEngine,
  contextMessageCount: number,
): EventHandler<"messageCreate"> {
  return {
    event: "messageCreate",
    once: false,

    async execute(message): Promise<void> {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (message.channel.type === ChannelType.DM) return;

      const botUser = message.client.user;
      if (!botUser) return;

      // Respond when the bot is directly mentioned or replied to
      const mentionPattern = new RegExp(`<@!?${botUser.id}>`);
      const isMentioned = mentionPattern.test(message.content);
      const isReplyToBot =
        message.reference?.messageId != null &&
        (
          await message.channel.messages
            .fetch(message.reference.messageId)
            .catch(() => null)
        )?.author.id === botUser.id;

      if (!isMentioned && !isReplyToBot) return;

      try {
        await message.channel.sendTyping();

        // Fetch a larger window of messages, then filter to only messages from the
        // person talking to the bot (+ bot replies to them) so the LLM doesn't
        // confuse other users' messages as belonging to the current speaker.
        const recentMessages: ChannelMessage[] = [];
        const fetched = await message.channel.messages.fetch({
          limit: 50,
          before: message.id,
        });

        const targetUserId = message.author.id;
        for (const msg of [...fetched.values()].reverse()) {
          const isBotReply = msg.author.id === botUser.id && !!msg.reference;
          const isTargetUser = msg.author.id === targetUserId;

          if (!isBotReply && !isTargetUser) continue;

          recentMessages.push({
            authorName: msg.author.displayName,
            authorIsBot: msg.author.id === botUser.id,
            content: msg.content,
          });
        }

        // Only keep the most recent messages up to the configured limit
        const trimmedMessages = recentMessages.slice(-contextMessageCount);

        const response = await chatEngine.respond(
          message.content,
          message.author.displayName,
          trimmedMessages,
        );

        await message.reply(response);
      } catch (error) {
        logger.error("Failed to respond to chat mention:", error);
      }
    },
  };
}
