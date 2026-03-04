import { REST, Routes } from "discord.js";
import { config } from "../src/utilities/config.js";
import { CommandEngine } from "../src/engines/command-engine.js";
import commands from "../src/commands/index.js";
import * as logger from "../src/utilities/logger.js";

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
