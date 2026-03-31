import type { EventHandler } from "../types/event.js";
import type { StarboardEngine } from "../engines/starboard-engine.js";
import * as logger from "../utilities/logger.js";

export function createStarboardAddHandler(
  starboardEngine: StarboardEngine,
  starboardChannelId: string,
): EventHandler<"messageReactionAdd"> {
  return {
    event: "messageReactionAdd",
    once: false,

    async execute(reaction, _user): Promise<void> {
      try {
        await starboardEngine.handleReactionUpdate(reaction, starboardChannelId);
      } catch (err) {
        logger.error("Starboard add handler error:", err);
      }
    },
  };
}

export function createStarboardRemoveHandler(
  starboardEngine: StarboardEngine,
  starboardChannelId: string,
): EventHandler<"messageReactionRemove"> {
  return {
    event: "messageReactionRemove",
    once: false,

    async execute(reaction, _user): Promise<void> {
      try {
        await starboardEngine.handleReactionUpdate(reaction, starboardChannelId);
      } catch (err) {
        logger.error("Starboard remove handler error:", err);
      }
    },
  };
}
