import { REST, Routes } from "discord.js";
import { config } from "../src/utilities/config.js";
import { CommandEngine } from "../src/engines/command-engine.js";
import { XpAccessor } from "../src/accessors/xp-accessor.js";
import { XpEngine } from "../src/engines/xp-engine.js";
import { createRankCommand } from "../src/commands/rank.js";
import { createLeaderboardCommand } from "../src/commands/leaderboard.js";
import { createXpCommand } from "../src/commands/xp.js";
import staticCommands from "../src/commands/index.js";
import * as logger from "../src/utilities/logger.js";

const xpAccessor = new XpAccessor();
const xpEngine = new XpEngine(
  xpAccessor,
  config.xpMin,
  config.xpMax,
  config.xpCooldownSeconds,
);

const commands = [
  ...staticCommands,
  createRankCommand(xpEngine),
  createLeaderboardCommand(xpEngine),
  createXpCommand(xpEngine),
];

const commandEngine = new CommandEngine(commands);
const rest = new REST().setToken(config.token);

async function deployCommands(): Promise<void> {
  const commandData = commandEngine.getSlashCommandData();

  logger.info(`Deploying ${commandData.length} slash command(s) to guild ${config.guildId}...`);

  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: commandData,
  });

  logger.info("Slash commands deployed successfully.");
}

deployCommands().catch((err) => {
  logger.error("Failed to deploy commands:", err);
  process.exit(1);
});
