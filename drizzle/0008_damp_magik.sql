CREATE TABLE `music_club_members` (
	`user_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `guild_id`)
);
--> statement-breakpoint
CREATE TABLE `music_club_ratings` (
	`song_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`rated_at` integer NOT NULL,
	PRIMARY KEY(`song_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `music_club_rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`starts_at` integer NOT NULL,
	`submissions_close_at` integer NOT NULL,
	`ratings_close_at` integer NOT NULL,
	`playlist_message_id` text DEFAULT '' NOT NULL,
	`results_message_id` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `music_club_rounds_guild_status_idx` ON `music_club_rounds` (`guild_id`,`status`);--> statement-breakpoint
CREATE TABLE `music_club_songs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`round_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`original_url` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`artist` text DEFAULT '' NOT NULL,
	`odesli_data` text DEFAULT '{}' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`submitted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `music_club_songs_round_user_unique` ON `music_club_songs` (`round_id`,`user_id`);