import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

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

export const campaignNarrativeLog = sqliteTable("campaign_narrative_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

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
