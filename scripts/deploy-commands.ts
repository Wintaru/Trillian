import { REST, Routes } from "discord.js";
import { config } from "../src/utilities/config.js";
import { CommandEngine } from "../src/engines/command-engine.js";
import { XpAccessor } from "../src/accessors/xp-accessor.js";
import { XpEngine } from "../src/engines/xp-engine.js";
import { createRankCommand } from "../src/commands/rank.js";
import { createLeaderboardCommand } from "../src/commands/leaderboard.js";
import { createXpCommand } from "../src/commands/xp.js";
import { createPollCommand } from "../src/commands/poll.js";
import { PollAccessor } from "../src/accessors/poll-accessor.js";
import { PollEngine } from "../src/engines/poll-engine.js";
import { OllamaAccessor } from "../src/accessors/ollama-accessor.js";
import { CampaignAccessor } from "../src/accessors/campaign-accessor.js";
import { CharacterAccessor } from "../src/accessors/character-accessor.js";
import { DiceEngine } from "../src/engines/dice-engine.js";
import { CampaignEngine } from "../src/engines/campaign-engine.js";
import { CharacterCreationEngine } from "../src/engines/character-creation-engine.js";
import { createCampaignCommand } from "../src/commands/campaign.js";
import { createCharacterCommand } from "../src/commands/character.js";
import { createRollCommand } from "../src/commands/roll.js";
import { createShadowrunInfoCommand } from "../src/commands/shadowrun-info.js";
import { EmbedEngine } from "../src/engines/embed-engine.js";
import { createEmbedCommand } from "../src/commands/embed.js";
import { DictionaryAccessor } from "../src/accessors/dictionary-accessor.js";
import { DictionaryEngine } from "../src/engines/dictionary-engine.js";
import { createDefineCommand } from "../src/commands/define.js";
import { DeeplAccessor } from "../src/accessors/deepl-accessor.js";
import { TranslateEngine } from "../src/engines/translate-engine.js";
import { createTranslateCommand } from "../src/commands/translate.js";
import { NwsAccessor } from "../src/accessors/nws-accessor.js";
import { WeatherApiAccessor } from "../src/accessors/weatherapi-accessor.js";
import { WeatherEngine } from "../src/engines/weather-engine.js";
import { createWeatherCommand } from "../src/commands/weather.js";
import staticCommands from "../src/commands/index.js";
import * as logger from "../src/utilities/logger.js";

const xpAccessor = new XpAccessor();
const xpEngine = new XpEngine(
  xpAccessor,
  config.xpMin,
  config.xpMax,
  config.xpCooldownSeconds,
);

const pollAccessor = new PollAccessor();
const pollEngine = new PollEngine(pollAccessor);

const ollamaAccessor = new OllamaAccessor(config.ollamaUrl, config.ollamaModel, config.ollamaGmTimeoutMs);
const campaignAccessor = new CampaignAccessor();
const characterAccessor = new CharacterAccessor();
const diceEngine = new DiceEngine();
const campaignEngine = new CampaignEngine(campaignAccessor, characterAccessor, ollamaAccessor, diceEngine);
const characterCreationEngine = new CharacterCreationEngine(characterAccessor, ollamaAccessor);

const embedEngine = new EmbedEngine();

const dictionaryAccessor = new DictionaryAccessor();
const dictionaryEngine = new DictionaryEngine(dictionaryAccessor);

const deeplAccessor = config.deeplApiKey
  ? new DeeplAccessor(config.deeplApiKey)
  : null;
const translateEngine = new TranslateEngine(ollamaAccessor, deeplAccessor);

const nwsAccessor = new NwsAccessor();
const weatherApiAccessor = config.weatherApiKey
  ? new WeatherApiAccessor(config.weatherApiKey)
  : null;
const weatherEngine = new WeatherEngine(nwsAccessor, weatherApiAccessor);

const commands = [
  ...staticCommands,
  createRankCommand(xpEngine),
  createLeaderboardCommand(xpEngine),
  createXpCommand(xpEngine),
  createPollCommand(pollEngine),
  createEmbedCommand(embedEngine),
  createCampaignCommand(campaignEngine, characterCreationEngine, campaignAccessor, characterAccessor, config.campaignChannelId),
  createCharacterCommand(characterAccessor, campaignAccessor, characterCreationEngine),
  createRollCommand(diceEngine),
  createShadowrunInfoCommand(ollamaAccessor),
  createWeatherCommand(weatherEngine, config.weatherLocation),
  createDefineCommand(dictionaryEngine),
  createTranslateCommand(translateEngine),
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
