import { config } from "./utilities/config.js";
import { CommandEngine } from "./engines/command-engine.js";
import { DiscordClient } from "./clients/discord-client.js";
import { XpAccessor } from "./accessors/xp-accessor.js";
import { XpEngine } from "./engines/xp-engine.js";
import { PollAccessor } from "./accessors/poll-accessor.js";
import { PollEngine } from "./engines/poll-engine.js";
import { PollButtonHandler } from "./engines/poll-button-handler.js";
import { createReadyHandler } from "./events/ready.js";
import { createMessageXpHandler } from "./events/message-xp.js";
import { createMessageChatHandler } from "./events/message-chat.js";
import { OllamaAccessor } from "./accessors/ollama-accessor.js";
import { ChatEngine } from "./engines/chat-engine.js";
import { createRankCommand } from "./commands/rank.js";
import { createLeaderboardCommand } from "./commands/leaderboard.js";
import { createXpCommand } from "./commands/xp.js";
import { createPollCommand } from "./commands/poll.js";
import { startPollTimer } from "./utilities/poll-timer.js";
import { defaultRanks } from "./db/seed-ranks.js";
import staticCommands from "./commands/index.js";
import staticEvents from "./events/index.js";
import * as logger from "./utilities/logger.js";

// Shadowrun campaign system
import { CampaignAccessor } from "./accessors/campaign-accessor.js";
import { CharacterAccessor } from "./accessors/character-accessor.js";
import { DiceEngine } from "./engines/dice-engine.js";
import { CampaignEngine } from "./engines/campaign-engine.js";
import { CharacterCreationEngine } from "./engines/character-creation-engine.js";
import { createCampaignCommand } from "./commands/campaign.js";
import { createCharacterCommand } from "./commands/character.js";
import { createRollCommand } from "./commands/roll.js";
import { createShadowrunInfoCommand } from "./commands/shadowrun-info.js";
import { createMessageCampaignHandler } from "./events/message-campaign.js";
import { createCharacterCreationDmHandler } from "./events/message-character-creation.js";

// Custom embeds
import { EmbedTemplateAccessor } from "./accessors/embed-template-accessor.js";
import { EmbedEngine } from "./engines/embed-engine.js";
import { EmbedButtonHandler } from "./engines/embed-button-handler.js";
import { createEmbedCommand } from "./commands/embed.js";

// Dictionary
import { DictionaryAccessor } from "./accessors/dictionary-accessor.js";
import { DictionaryEngine } from "./engines/dictionary-engine.js";
import { createDefineCommand } from "./commands/define.js";

// Translation
import { DeeplAccessor } from "./accessors/deepl-accessor.js";
import { TranslateEngine } from "./engines/translate-engine.js";
import { createTranslateCommand } from "./commands/translate.js";

// Vocabulary system
import { VocabAccessor } from "./accessors/vocab-accessor.js";
import { VocabEngine } from "./engines/vocab-engine.js";
import { VocabButtonHandler } from "./engines/vocab-button-handler.js";
import { createVocabCommand } from "./commands/vocab.js";
import { startVocabTimer } from "./utilities/vocab-timer.js";

// Lesson system
import { LessonAccessor } from "./accessors/lesson-accessor.js";
import { LessonEngine } from "./engines/lesson-engine.js";
import { createLessonCommand } from "./commands/lesson.js";
import { createLessonDmHandler } from "./events/message-lesson.js";

// Weather system
import { NwsAccessor } from "./accessors/nws-accessor.js";
import { WeatherApiAccessor } from "./accessors/weatherapi-accessor.js";
import { WeatherAlertAccessor } from "./accessors/weather-alert-accessor.js";
import { WeatherEngine } from "./engines/weather-engine.js";
import { createWeatherCommand } from "./commands/weather.js";
import { startWeatherTimer } from "./utilities/weather-timer.js";

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
const ollamaGmAccessor = new OllamaAccessor(config.ollamaUrl, config.ollamaModel, config.ollamaGmTimeoutMs);
const chatEngine = new ChatEngine(ollamaAccessor);

const pollAccessor = new PollAccessor();
const pollEngine = new PollEngine(pollAccessor);
const pollButtonHandler = new PollButtonHandler(pollEngine);

// Shadowrun campaign setup
const campaignAccessor = new CampaignAccessor();
const characterAccessor = new CharacterAccessor();
const diceEngine = new DiceEngine();
const campaignEngine = new CampaignEngine(campaignAccessor, characterAccessor, ollamaGmAccessor, diceEngine);
const characterCreationEngine = new CharacterCreationEngine(characterAccessor, ollamaGmAccessor);

const embedTemplateAccessor = new EmbedTemplateAccessor();
const embedEngine = new EmbedEngine(embedTemplateAccessor);
const embedButtonHandler = new EmbedButtonHandler(embedEngine);

// Dictionary
const dictionaryAccessor = new DictionaryAccessor();
const dictionaryEngine = new DictionaryEngine(dictionaryAccessor);

// Translation
const deeplAccessor = config.deeplApiKey
  ? new DeeplAccessor(config.deeplApiKey)
  : null;
const translateEngine = new TranslateEngine(ollamaAccessor, deeplAccessor);

// Vocabulary system
const vocabAccessor = new VocabAccessor();
const vocabEngine = new VocabEngine(ollamaAccessor, vocabAccessor);
const vocabButtonHandler = new VocabButtonHandler(vocabEngine);

// Lesson system
const lessonAccessor = new LessonAccessor();
const lessonEngine = new LessonEngine(ollamaAccessor, lessonAccessor);

// Weather system
const nwsAccessor = new NwsAccessor();
const weatherApiAccessor = config.weatherApiKey
  ? new WeatherApiAccessor(config.weatherApiKey)
  : null;
const weatherAlertAccessor = new WeatherAlertAccessor();
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
  createShadowrunInfoCommand(ollamaGmAccessor),
  createWeatherCommand(weatherEngine, config.weatherLocation),
  createDefineCommand(dictionaryEngine),
  createTranslateCommand(translateEngine),
  createVocabCommand(vocabEngine),
  createLessonCommand(lessonEngine, config.vocabDefaultLanguage),
];

const events = [
  ...staticEvents,
  createReadyHandler(config.announceChannelId),
  createMessageXpHandler(xpEngine, config.levelUpChannelId),
  ...(config.campaignChannelId
    ? [createMessageCampaignHandler(campaignEngine, campaignAccessor, config.campaignChannelId)]
    : []),
  createCharacterCreationDmHandler(characterCreationEngine, characterAccessor, campaignAccessor),
  createLessonDmHandler(lessonEngine, characterAccessor),
  createMessageChatHandler(chatEngine, config.ollamaContextMessages),
];

const commandEngine = new CommandEngine(commands);
const discordClient = new DiscordClient(
  commandEngine,
  events,
  config.prefix,
  [pollButtonHandler, embedButtonHandler, vocabButtonHandler],
  [embedButtonHandler],
);

await discordClient.start(config.token);

const shutdown = () => {
  logger.info("Shutting down...");
  discordClient.stop();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
startPollTimer(discordClient.getClient(), pollEngine);

if (config.weatherChannelId && config.weatherLocation) {
  startWeatherTimer(
    discordClient.getClient(),
    weatherEngine,
    weatherAlertAccessor,
    config.weatherChannelId,
    config.weatherLocation,
    config.weatherDailyTime,
    config.weatherAlertIntervalMs,
  );
  logger.info(`Weather timer started for "${config.weatherLocation}" in channel ${config.weatherChannelId}`);
}

if (config.vocabChannelId) {
  startVocabTimer(
    discordClient.getClient(),
    vocabEngine,
    vocabAccessor,
    config.vocabChannelId,
    config.vocabDailyTime,
    config.vocabDefaultLanguage,
  );
  logger.info(`Vocab timer started (${config.vocabDefaultLanguage}) in channel ${config.vocabChannelId}`);
}
