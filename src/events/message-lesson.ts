import { ChannelType } from "discord.js";
import type { EventHandler } from "../types/event.js";
import type { LessonEngine } from "../engines/lesson-engine.js";
import type { CharacterAccessor } from "../accessors/character-accessor.js";
import * as logger from "../utilities/logger.js";

const STOP_KEYWORDS = new Set(["stop", "end", "quit", "exit"]);

export function createLessonDmHandler(
  lessonEngine: LessonEngine,
  characterAccessor: CharacterAccessor,
): EventHandler<"messageCreate"> {
  return {
    event: "messageCreate",
    once: false,

    async execute(message): Promise<void> {
      if (message.author.bot) return;
      if (message.channel.type !== ChannelType.DM) return;

      const userId = message.author.id;

      // Character creation takes priority over lessons
      const inProgress = await characterAccessor.getInProgressCharacterForUser(userId);
      if (inProgress) return;

      // Check if the user wants to stop
      const content = message.content.trim();
      if (STOP_KEYWORDS.has(content.toLowerCase())) {
        const result = await lessonEngine.stopLesson({ userId });
        if (result.ended) {
          await message.reply("Your lesson has ended. Great work!");
          return;
        }
        // If no active session, fall through — don't consume the message
      }

      // Check for active lesson
      const status = await lessonEngine.getStatus({ userId });
      if (!status.active) return;

      try {
        await message.channel.sendTyping();
        const result = await lessonEngine.processMessage({ userId, content });
        await message.reply(result.reply.slice(0, 2000));
      } catch (error) {
        logger.error("Lesson DM handler failed:", error);
        await message.reply("Something went wrong with your lesson. Try again or use `/lesson stop` to end it.").catch(() => {});
      }
    },
  };
}
