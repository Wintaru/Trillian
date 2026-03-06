CREATE TABLE `campaign_narrative_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `campaign_players` (
	`campaign_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`character_id` integer,
	`joined_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	PRIMARY KEY(`campaign_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`gm_user_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`setting` text DEFAULT '' NOT NULL,
	`current_objective` text,
	`current_location` text,
	`last_ping_message_id` text,
	`last_ping_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `characters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`campaign_id` integer NOT NULL,
	`name` text NOT NULL,
	`metatype` text NOT NULL,
	`archetype` text,
	`body` integer DEFAULT 1 NOT NULL,
	`agility` integer DEFAULT 1 NOT NULL,
	`reaction` integer DEFAULT 1 NOT NULL,
	`strength` integer DEFAULT 1 NOT NULL,
	`willpower` integer DEFAULT 1 NOT NULL,
	`logic` integer DEFAULT 1 NOT NULL,
	`intuition` integer DEFAULT 1 NOT NULL,
	`charisma` integer DEFAULT 1 NOT NULL,
	`edge` integer DEFAULT 1 NOT NULL,
	`essence` text DEFAULT '6.0' NOT NULL,
	`magic` integer DEFAULT 0,
	`resonance` integer DEFAULT 0,
	`skills` text DEFAULT '[]' NOT NULL,
	`qualities` text DEFAULT '[]' NOT NULL,
	`spells` text DEFAULT '[]' NOT NULL,
	`gear` text DEFAULT '[]' NOT NULL,
	`contacts` text DEFAULT '[]' NOT NULL,
	`cyberware` text DEFAULT '[]' NOT NULL,
	`nuyen` integer DEFAULT 0 NOT NULL,
	`karma` integer DEFAULT 0 NOT NULL,
	`lifestyle` text DEFAULT 'squatter',
	`physical_cm_max` integer DEFAULT 10 NOT NULL,
	`physical_cm_current` integer DEFAULT 0 NOT NULL,
	`stun_cm_max` integer DEFAULT 10 NOT NULL,
	`stun_cm_current` integer DEFAULT 0 NOT NULL,
	`creation_status` text DEFAULT 'in_progress' NOT NULL,
	`creation_step` text DEFAULT 'metatype' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dice_rolls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`character_id` integer,
	`user_id` text NOT NULL,
	`pool` integer NOT NULL,
	`hits` integer NOT NULL,
	`ones` integer NOT NULL,
	`limit_value` integer,
	`is_glitch` integer DEFAULT 0 NOT NULL,
	`is_critical_glitch` integer DEFAULT 0 NOT NULL,
	`edge_used` text,
	`description` text,
	`results` text NOT NULL,
	`created_at` integer NOT NULL
);
