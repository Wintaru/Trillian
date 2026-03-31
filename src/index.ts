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

// Translation challenges
import { ChallengeAccessor } from "./accessors/challenge-accessor.js";
import { ChallengeEngine } from "./engines/challenge-engine.js";
import { ChallengeButtonHandler } from "./engines/challenge-button-handler.js";
import { createChallengeCommand } from "./commands/challenge.js";
import { startChallengePostTimer, startChallengeCloseTimer } from "./utilities/challenge-timer.js";

// Music club
import { MusicClubAccessor } from "./accessors/music-club-accessor.js";
import { SongMetadataAccessor } from "./accessors/song-metadata-accessor.js";
import { MusicClubEngine } from "./engines/music-club-engine.js";
import { MusicClubButtonHandler } from "./engines/music-club-button-handler.js";
import { createMusicClubCommand } from "./commands/music-club.js";
import { startMusicClubRoundTimer, startMusicClubTransitionTimer } from "./utilities/music-club-timer.js";

// Weather system
import { NwsAccessor } from "./accessors/nws-accessor.js";
import { WeatherApiAccessor } from "./accessors/weatherapi-accessor.js";
import { WeatherAlertAccessor } from "./accessors/weather-alert-accessor.js";
import { WeatherEngine } from "./engines/weather-engine.js";
import { createWeatherCommand } from "./commands/weather.js";
import { startWeatherTimer } from "./utilities/weather-timer.js";

// Recipe system
import { RecipeAccessor } from "./accessors/recipe-accessor.js";
import { WebScraperAccessor } from "./accessors/web-scraper-accessor.js";
import { RecipeEngine } from "./engines/recipe-engine.js";
import { createRecipeCommand } from "./commands/recipe.js";
import { createMessageRecipeHandler } from "./events/message-recipe.js";
import { backfillRecipes } from "./utilities/recipe-backfill.js";

// Link decrapifier
import { RedirectAccessor } from "./accessors/redirect-accessor.js";
import { CleanLinksEngine } from "./engines/clean-links-engine.js";
import { createCleanUrlCommand } from "./commands/clean-url.js";
import { createMessageCleanLinksHandler } from "./events/message-clean-links.js";

// Community library
import { LibraryAccessor } from "./accessors/library-accessor.js";
import { OpenLibraryAccessor } from "./accessors/open-library-accessor.js";
import { LibraryEngine } from "./engines/library-engine.js";
import { LibraryButtonHandler } from "./engines/library-button-handler.js";
import { createLibraryCommand } from "./commands/library.js";
import { startLibraryTimer } from "./utilities/library-timer.js";

// Channel stats
import { ChannelAccessor } from "./accessors/channel-accessor.js";
import { ChannelStatsAccessor } from "./accessors/channel-stats-accessor.js";
import { ChannelStatsEngine } from "./engines/channel-stats-engine.js";
import { createChannelStatsCommand } from "./commands/channel-stats.js";

// Birthday system
import { BirthdayAccessor } from "./accessors/birthday-accessor.js";
import { BirthdayEngine } from "./engines/birthday-engine.js";
import { createBirthdayCommand } from "./commands/birthday.js";
import { startBirthdayTimer } from "./utilities/birthday-timer.js";

// Reminder system
import { ReminderAccessor } from "./accessors/reminder-accessor.js";
import { ReminderEngine } from "./engines/reminder-engine.js";
import { createRemindCommand } from "./commands/remind.js";
import { startReminderTimer } from "./utilities/reminder-timer.js";

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

// Translation challenges
const challengeAccessor = new ChallengeAccessor();
const challengeEngine = new ChallengeEngine(ollamaAccessor, challengeAccessor);
const challengeButtonHandler = new ChallengeButtonHandler(challengeEngine);

// Music club
const musicClubAccessor = new MusicClubAccessor();
const songMetadataAccessor = new SongMetadataAccessor();
const musicClubEngine = new MusicClubEngine(musicClubAccessor, songMetadataAccessor);
const musicClubButtonHandler = new MusicClubButtonHandler(musicClubEngine);

// Recipe system
const recipeAccessor = new RecipeAccessor();
const webScraperAccessor = new WebScraperAccessor();
const recipeEngine = new RecipeEngine(ollamaAccessor, recipeAccessor, webScraperAccessor);

// Link decrapifier
const redirectAccessor = new RedirectAccessor();
const cleanLinksEngine = new CleanLinksEngine(redirectAccessor);

// Community library
const libraryAccessor = new LibraryAccessor();
const openLibraryAccessor = new OpenLibraryAccessor(config.googleApiKey);
const libraryEngine = new LibraryEngine(libraryAccessor, openLibraryAccessor, config.libraryDefaultLoanDays);
const libraryButtonHandler = new LibraryButtonHandler(libraryEngine);

// Channel stats
const channelAccessor = new ChannelAccessor();
const channelStatsAccessor = new ChannelStatsAccessor();
const channelStatsEngine = new ChannelStatsEngine(channelAccessor, channelStatsAccessor);

// Birthday system
const birthdayAccessor = new BirthdayAccessor();
const birthdayEngine = new BirthdayEngine(birthdayAccessor);

// Reminder system
const reminderAccessor = new ReminderAccessor();
const reminderEngine = new ReminderEngine(reminderAccessor);

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
  createVocabCommand(vocabEngine, vocabAccessor, config.vocabDefaultLanguage),
  createLessonCommand(lessonEngine, config.vocabDefaultLanguage),
  createChallengeCommand(challengeEngine),
  createMusicClubCommand(musicClubEngine),
  createRecipeCommand(recipeEngine),
  createCleanUrlCommand(cleanLinksEngine),
  createLibraryCommand(libraryEngine, config.libraryChannelId),
  createChannelStatsCommand(channelStatsEngine, config.prefix),
  createBirthdayCommand(birthdayEngine),
  createRemindCommand(reminderEngine),
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
  ...(config.recipeChannelId
    ? [createMessageRecipeHandler(recipeEngine, config.recipeChannelId)]
    : []),
  createMessageCleanLinksHandler(cleanLinksEngine, config.cleanLinksChannelIds),
];

const commandEngine = new CommandEngine(commands);
const discordClient = new DiscordClient(
  commandEngine,
  events,
  config.prefix,
  [pollButtonHandler, embedButtonHandler, vocabButtonHandler, challengeButtonHandler, musicClubButtonHandler, libraryButtonHandler],
  [embedButtonHandler, challengeButtonHandler, musicClubButtonHandler, libraryButtonHandler],
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
startReminderTimer(discordClient.getClient(), reminderEngine);

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

if (config.musicClubChannelId) {
  startMusicClubRoundTimer(
    discordClient.getClient(),
    musicClubEngine,
    musicClubAccessor,
    config.musicClubChannelId,
    config.musicClubRoundDay,
    config.musicClubRoundTime,
    config.musicClubSubmissionDays,
    config.musicClubRatingDays,
    config.guildId,
  );
  startMusicClubTransitionTimer(
    discordClient.getClient(),
    musicClubEngine,
    musicClubAccessor,
    config.musicClubChannelId,
    config.guildId,
    config.musicClubSubmissionDays,
    config.musicClubRatingDays,
  );
  logger.info(`Music club timer started in channel ${config.musicClubChannelId}`);
}

if (config.challengeChannelId) {
  startChallengePostTimer(
    discordClient.getClient(),
    challengeEngine,
    challengeAccessor,
    config.challengeChannelId,
    config.challengeDailyTime,
    config.vocabDefaultLanguage,
    config.challengeDirection,
    config.challengeDurationMinutes,
    config.guildId,
  );
  startChallengeCloseTimer(discordClient.getClient(), challengeEngine);
  logger.info(`Challenge timer started (${config.challengeDirection}) in channel ${config.challengeChannelId}`);
}

if (config.recipeChannelId) {
  // Run backfill in background — don't block startup
  backfillRecipes(discordClient.getClient(), recipeEngine, config.recipeChannelId).catch((err) =>
    logger.error("Recipe backfill failed:", err),
  );
  logger.info(`Recipe system active in channel ${config.recipeChannelId}`);
}

if (config.libraryChannelId) {
  startLibraryTimer(discordClient.getClient(), libraryEngine);
  logger.info(`Library system active in channel ${config.libraryChannelId}`);
}

if (config.birthdayChannelId) {
  startBirthdayTimer(
    discordClient.getClient(),
    birthdayEngine,
    config.birthdayChannelId,
    config.guildId,
    config.birthdayCheckTime,
  );
  logger.info(`Birthday timer started, announcing at ${config.birthdayCheckTime} in channel ${config.birthdayChannelId}`);
}
