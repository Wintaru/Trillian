import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const userXp = sqliteTable(
  "user_xp",
  {
    userId: text("user_id").notNull(),
    guildId: text("guild_id").notNull(),
    xp: integer("xp").notNull().default(0),
    level: integer("level").notNull().default(0),
    lastXpAt: integer("last_xp_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.guildId] })],
);

export const ranks = sqliteTable("ranks", {
  level: integer("level").primaryKey(),
  name: text("name").notNull(),
});

export const levelRoleRewards = sqliteTable("level_role_rewards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id").notNull(),
  level: integer("level").notNull(),
  roleId: text("role_id").notNull(),
});

export const polls = sqliteTable("polls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id").notNull().default(""),
  creatorId: text("creator_id").notNull(),
  question: text("question").notNull(),
  options: text("options").notNull(),
  status: text("status").notNull().default("open"),
  closesAt: integer("closes_at"),
  createdAt: integer("created_at").notNull(),
});

export const pollVotes = sqliteTable(
  "poll_votes",
  {
    pollId: integer("poll_id").notNull(),
    userId: text("user_id").notNull(),
    optionIndex: integer("option_index").notNull(),
  },
  (table) => [primaryKey({ columns: [table.pollId, table.userId] })],
);

// --- Shadowrun Campaign System ---

export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  gmUserId: text("gm_user_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  setting: text("setting").notNull().default(""),
  currentObjective: text("current_objective"),
  currentLocation: text("current_location"),
  lastPingMessageId: text("last_ping_message_id"),
  lastPingAt: integer("last_ping_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const campaignPlayers = sqliteTable(
  "campaign_players",
  {
    campaignId: integer("campaign_id").notNull(),
    userId: text("user_id").notNull(),
    characterId: integer("character_id"),
    joinedAt: integer("joined_at").notNull(),
    status: text("status").notNull().default("active"),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.userId] })],
);

export const characters = sqliteTable("characters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  campaignId: integer("campaign_id"),
  name: text("name").notNull(),
  metatype: text("metatype").notNull(),
  archetype: text("archetype"),

  body: integer("body").notNull().default(1),
  agility: integer("agility").notNull().default(1),
  reaction: integer("reaction").notNull().default(1),
  strength: integer("strength").notNull().default(1),
  willpower: integer("willpower").notNull().default(1),
  logic: integer("logic").notNull().default(1),
  intuition: integer("intuition").notNull().default(1),
  charisma: integer("charisma").notNull().default(1),

  edge: integer("edge").notNull().default(1),
  essence: text("essence").notNull().default("6.0"),
  magic: integer("magic").default(0),
  resonance: integer("resonance").default(0),

  skills: text("skills").notNull().default("[]"),
  qualities: text("qualities").notNull().default("[]"),
  spells: text("spells").notNull().default("[]"),
  gear: text("gear").notNull().default("[]"),
  contacts: text("contacts").notNull().default("[]"),
  cyberware: text("cyberware").notNull().default("[]"),

  nuyen: integer("nuyen").notNull().default(0),
  karma: integer("karma").notNull().default(0),
  lifestyle: text("lifestyle").default("squatter"),

  physicalCmMax: integer("physical_cm_max").notNull().default(10),
  physicalCmCurrent: integer("physical_cm_current").notNull().default(0),
  stunCmMax: integer("stun_cm_max").notNull().default(10),
  stunCmCurrent: integer("stun_cm_current").notNull().default(0),

  creationStatus: text("creation_status").notNull().default("in_progress"),
  creationStep: text("creation_step").notNull().default("metatype"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// --- Custom Embeds ---

export const embedTemplates = sqliteTable(
  "embed_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    embedData: text("embed_data").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("embed_templates_guild_user_name_unique").on(
      table.guildId,
      table.userId,
      table.name,
    ),
  ],
);

export const campaignNarrativeLog = sqliteTable("campaign_narrative_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

// --- Weather Alerts ---

export const postedWeatherAlerts = sqliteTable("posted_weather_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertId: text("alert_id").notNull().unique(),
  channelId: text("channel_id").notNull(),
  postedAt: integer("posted_at").notNull(),
});

// --- Vocabulary / Word of the Day ---

export const dailyWords = sqliteTable(
  "daily_words",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    word: text("word").notNull(),
    language: text("language").notNull(),
    translation: text("translation").notNull(),
    pronunciation: text("pronunciation").notNull(),
    exampleSentence: text("example_sentence").notNull(),
    exampleTranslation: text("example_translation").notNull(),
    linguisticNotes: text("linguistic_notes").notNull(),
    postedAt: integer("posted_at").notNull(),
  },
  (table) => [
    uniqueIndex("daily_words_word_language_unique").on(table.word, table.language),
  ],
);

export const userVocabulary = sqliteTable(
  "user_vocabulary",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    dailyWordId: integer("daily_word_id").notNull(),
    savedAt: integer("saved_at").notNull(),
    reviewCount: integer("review_count").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    easeFactor: real("ease_factor").notNull().default(2.5),
    interval: integer("interval").notNull().default(0),
    repetition: integer("repetition").notNull().default(0),
    nextReviewAt: integer("next_review_at"),
    lastReviewedAt: integer("last_reviewed_at"),
  },
  (table) => [
    uniqueIndex("user_vocabulary_user_word_unique").on(table.userId, table.dailyWordId),
  ],
);

export const diceRolls = sqliteTable("dice_rolls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  characterId: integer("character_id"),
  userId: text("user_id").notNull(),
  pool: integer("pool").notNull(),
  hits: integer("hits").notNull(),
  ones: integer("ones").notNull(),
  limitValue: integer("limit_value"),
  isGlitch: integer("is_glitch").notNull().default(0),
  isCriticalGlitch: integer("is_critical_glitch").notNull().default(0),
  edgeUsed: text("edge_used"),
  description: text("description"),
  results: text("results").notNull(),
  createdAt: integer("created_at").notNull(),
});

// --- Language Lessons ---

export const lessonSessions = sqliteTable("lesson_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  language: text("language").notNull(),
  status: text("status").notNull().default("active"),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
});

export const lessonMessages = sqliteTable("lesson_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

// --- Translation Challenges ---

export const challenges = sqliteTable("challenges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id").notNull().default(""),
  language: text("language").notNull(),
  direction: text("direction").notNull(),
  sentence: text("sentence").notNull(),
  referenceTranslation: text("reference_translation").notNull(),
  context: text("context").notNull().default(""),
  status: text("status").notNull().default("open"),
  closesAt: integer("closes_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const challengeSubmissions = sqliteTable(
  "challenge_submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    challengeId: integer("challenge_id").notNull(),
    userId: text("user_id").notNull(),
    translation: text("translation").notNull(),
    accuracyScore: real("accuracy_score").notNull(),
    grammarScore: real("grammar_score").notNull(),
    naturalnessScore: real("naturalness_score").notNull(),
    compositeScore: real("composite_score").notNull(),
    feedback: text("feedback").notNull(),
    submittedAt: integer("submitted_at").notNull(),
  },
  (table) => [
    uniqueIndex("challenge_submissions_challenge_user_unique").on(
      table.challengeId,
      table.userId,
    ),
  ],
);

// --- Music Club ---

export const musicClubMembers = sqliteTable(
  "music_club_members",
  {
    userId: text("user_id").notNull(),
    guildId: text("guild_id").notNull(),
    joinedAt: integer("joined_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.guildId] })],
);

export const musicClubRounds = sqliteTable(
  "music_club_rounds",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),
    messageId: text("message_id").notNull().default(""),
    status: text("status").notNull().default("open"),
    startsAt: integer("starts_at").notNull(),
    submissionsCloseAt: integer("submissions_close_at").notNull(),
    ratingsCloseAt: integer("ratings_close_at").notNull(),
    playlistMessageId: text("playlist_message_id").notNull().default(""),
    resultsMessageId: text("results_message_id").notNull().default(""),
    submissionReminderSent: integer("submission_reminder_sent").notNull().default(0),
    ratingReminderSent: integer("rating_reminder_sent").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("music_club_rounds_guild_status_idx").on(table.guildId, table.status),
  ],
);

export const musicClubSongs = sqliteTable(
  "music_club_songs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roundId: integer("round_id").notNull(),
    userId: text("user_id").notNull(),
    originalUrl: text("original_url").notNull(),
    title: text("title").notNull().default(""),
    artist: text("artist").notNull().default(""),
    odesliData: text("odesli_data").notNull().default("{}"),
    reason: text("reason").notNull().default(""),
    submittedAt: integer("submitted_at").notNull(),
  },
  (table) => [
    uniqueIndex("music_club_songs_round_user_unique").on(table.roundId, table.userId),
  ],
);

export const musicClubRatings = sqliteTable(
  "music_club_ratings",
  {
    songId: integer("song_id").notNull(),
    userId: text("user_id").notNull(),
    rating: integer("rating").notNull(),
    ratedAt: integer("rated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.songId, table.userId] })],
);

// --- Recipes ---

export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id").notNull(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  instructions: text("instructions").notNull(),
  sourceUrl: text("source_url"),
  createdAt: integer("created_at").notNull(),
});

export const recipeIngredients = sqliteTable(
  "recipe_ingredients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipeId: integer("recipe_id").notNull(),
    name: text("name").notNull(),
    quantity: text("quantity"),
  },
  (table) => [
    index("recipe_ingredients_recipe_id_idx").on(table.recipeId),
    index("recipe_ingredients_name_idx").on(table.name),
  ],
);
