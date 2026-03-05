import { config } from "./utilities/config.js";
import { CommandEngine } from "./engines/command-engine.js";
import { DiscordClient } from "./clients/discord-client.js";
import { XpAccessor } from "./accessors/xp-accessor.js";
import { XpEngine } from "./engines/xp-engine.js";
import { createMessageXpHandler } from "./events/message-xp.js";
import { createMessageChatHandler } from "./events/message-chat.js";
import { OllamaAccessor } from "./accessors/ollama-accessor.js";
import { ChatEngine } from "./engines/chat-engine.js";
import { createRankCommand } from "./commands/rank.js";
import { createLeaderboardCommand } from "./commands/leaderboard.js";
import { createXpCommand } from "./commands/xp.js";
import { defaultRanks } from "./db/seed-ranks.js";
import staticCommands from "./commands/index.js";
import staticEvents from "./events/index.js";
import * as logger from "./utilities/logger.js";

const xpAccessor = new XpAccessor();
const xpEngine = new XpEngine(
  xpAccessor,
  config.xpMin,
  config.xpMax,
  config.xpCooldownSeconds,
);

await xpAccessor.seedRanks(defaultRanks);
logger.info("Rank data seeded.");

const ollamaAccessor = new OllamaAccessor(config.ollamaUrl, config.ollamaModel);
const chatEngine = new ChatEngine(ollamaAccessor);

const commands = [
  ...staticCommands,
  createRankCommand(xpEngine),
  createLeaderboardCommand(xpEngine),
  createXpCommand(xpEngine),
];

const events = [
  ...staticEvents,
  createMessageXpHandler(xpEngine, config.levelUpChannelId),
  createMessageChatHandler(chatEngine, config.ollamaContextMessages),
];

const commandEngine = new CommandEngine(commands);
const discordClient = new DiscordClient(commandEngine, events, config.prefix);

discordClient.start(config.token);
