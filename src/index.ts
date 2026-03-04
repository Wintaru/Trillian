import { config } from "./utilities/config.js";
import { CommandEngine } from "./engines/command-engine.js";
import { DiscordClient } from "./clients/discord-client.js";
import commands from "./commands/index.js";
import events from "./events/index.js";

const commandEngine = new CommandEngine(commands);
const discordClient = new DiscordClient(commandEngine, events, config.prefix);

discordClient.start(config.token);
