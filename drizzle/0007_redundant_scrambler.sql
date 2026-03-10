CREATE TABLE `challenge_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`challenge_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`translation` text NOT NULL,
	`accuracy_score` real NOT NULL,
	`grammar_score` real NOT NULL,
	`naturalness_score` real NOT NULL,
	`composite_score` real NOT NULL,
	`feedback` text NOT NULL,
	`submitted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_submissions_challenge_user_unique` ON `challenge_submissions` (`challenge_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text DEFAULT '' NOT NULL,
	`language` text NOT NULL,
	`direction` text NOT NULL,
	`sentence` text NOT NULL,
	`reference_translation` text NOT NULL,
	`context` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`closes_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
