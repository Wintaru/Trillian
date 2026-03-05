CREATE TABLE `level_role_rewards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`level` integer NOT NULL,
	`role_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ranks` (
	`level` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_xp` (
	`user_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`last_xp_at` integer,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `guild_id`)
);
