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
