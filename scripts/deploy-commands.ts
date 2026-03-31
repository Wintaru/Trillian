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
import { VocabAccessor } from "../src/accessors/vocab-accessor.js";
import { VocabEngine } from "../src/engines/vocab-engine.js";
import { createVocabCommand } from "../src/commands/vocab.js";
import { LessonAccessor } from "../src/accessors/lesson-accessor.js";
import { LessonEngine } from "../src/engines/lesson-engine.js";
import { createLessonCommand } from "../src/commands/lesson.js";
import { ChallengeAccessor } from "../src/accessors/challenge-accessor.js";
import { ChallengeEngine } from "../src/engines/challenge-engine.js";
import { createChallengeCommand } from "../src/commands/challenge.js";
import { MusicClubAccessor } from "../src/accessors/music-club-accessor.js";
import { SongMetadataAccessor } from "../src/accessors/song-metadata-accessor.js";
import { MusicClubEngine } from "../src/engines/music-club-engine.js";
import { createMusicClubCommand } from "../src/commands/music-club.js";
import { NwsAccessor } from "../src/accessors/nws-accessor.js";
import { WeatherApiAccessor } from "../src/accessors/weatherapi-accessor.js";
import { WeatherEngine } from "../src/engines/weather-engine.js";
import { createWeatherCommand } from "../src/commands/weather.js";
import { RecipeAccessor } from "../src/accessors/recipe-accessor.js";
import { WebScraperAccessor } from "../src/accessors/web-scraper-accessor.js";
import { RecipeEngine } from "../src/engines/recipe-engine.js";
import { createRecipeCommand } from "../src/commands/recipe.js";
import { RedirectAccessor } from "../src/accessors/redirect-accessor.js";
import { CleanLinksEngine } from "../src/engines/clean-links-engine.js";
import { createCleanUrlCommand } from "../src/commands/clean-url.js";
import { LibraryAccessor } from "../src/accessors/library-accessor.js";
import { OpenLibraryAccessor } from "../src/accessors/open-library-accessor.js";
import { LibraryEngine } from "../src/engines/library-engine.js";
import { createLibraryCommand } from "../src/commands/library.js";
import { ChannelAccessor } from "../src/accessors/channel-accessor.js";
import { ChannelStatsAccessor } from "../src/accessors/channel-stats-accessor.js";
import { ChannelStatsEngine } from "../src/engines/channel-stats-engine.js";
import { createChannelStatsCommand } from "../src/commands/channel-stats.js";
import { BirthdayAccessor } from "../src/accessors/birthday-accessor.js";
import { BirthdayEngine } from "../src/engines/birthday-engine.js";
import { createBirthdayCommand } from "../src/commands/birthday.js";
import { ReminderAccessor } from "../src/accessors/reminder-accessor.js";
import { ReminderEngine } from "../src/engines/reminder-engine.js";
import { createRemindCommand } from "../src/commands/remind.js";
import { createIntroductionCommand } from "../src/commands/introduction.js";
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

const vocabAccessor = new VocabAccessor();
const vocabEngine = new VocabEngine(ollamaAccessor, vocabAccessor);

const lessonAccessor = new LessonAccessor();
const lessonEngine = new LessonEngine(ollamaAccessor, lessonAccessor);

const nwsAccessor = new NwsAccessor();
const weatherApiAccessor = config.weatherApiKey
  ? new WeatherApiAccessor(config.weatherApiKey)
  : null;
const weatherEngine = new WeatherEngine(nwsAccessor, weatherApiAccessor);

const challengeAccessor = new ChallengeAccessor();
const challengeEngine = new ChallengeEngine(ollamaAccessor, challengeAccessor);

const musicClubAccessor = new MusicClubAccessor();
const songMetadataAccessor = new SongMetadataAccessor();
const musicClubEngine = new MusicClubEngine(musicClubAccessor, songMetadataAccessor);

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
  createVocabCommand(vocabEngine, vocabAccessor, config.vocabDefaultLanguage),
  createLessonCommand(lessonEngine, config.vocabDefaultLanguage),
  createChallengeCommand(challengeEngine),
  createMusicClubCommand(musicClubEngine),
  createRecipeCommand(new RecipeEngine(ollamaAccessor, new RecipeAccessor(), new WebScraperAccessor())),
  createCleanUrlCommand(new CleanLinksEngine(new RedirectAccessor())),
  createLibraryCommand(
    new LibraryEngine(new LibraryAccessor(), new OpenLibraryAccessor(config.googleApiKey), config.libraryDefaultLoanDays),
    config.libraryChannelId,
  ),
  createChannelStatsCommand(
    new ChannelStatsEngine(new ChannelAccessor(), new ChannelStatsAccessor()),
    config.prefix,
  ),
  createBirthdayCommand(new BirthdayEngine(new BirthdayAccessor())),
  createRemindCommand(new ReminderEngine(new ReminderAccessor())),
  createIntroductionCommand(config.prefix),
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
