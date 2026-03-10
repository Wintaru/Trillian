CREATE TABLE `daily_words` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`word` text NOT NULL,
	`language` text NOT NULL,
	`translation` text NOT NULL,
	`pronunciation` text NOT NULL,
	`example_sentence` text NOT NULL,
	`example_translation` text NOT NULL,
	`linguistic_notes` text NOT NULL,
	`posted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_words_word_language_unique` ON `daily_words` (`word`,`language`);--> statement-breakpoint
CREATE TABLE `embed_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`embed_data` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `embed_templates_guild_user_name_unique` ON `embed_templates` (`guild_id`,`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `posted_weather_alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alert_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`posted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posted_weather_alerts_alert_id_unique` ON `posted_weather_alerts` (`alert_id`);--> statement-breakpoint
CREATE TABLE `user_vocabulary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`daily_word_id` integer NOT NULL,
	`saved_at` integer NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_vocabulary_user_word_unique` ON `user_vocabulary` (`user_id`,`daily_word_id`);