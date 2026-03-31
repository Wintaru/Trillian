CREATE TABLE `starboard_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`original_message_id` text NOT NULL,
	`original_channel_id` text NOT NULL,
	`original_author_id` text NOT NULL,
	`author_display_name` text NOT NULL,
	`message_content` text DEFAULT '' NOT NULL,
	`starboard_message_id` text,
	`star_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `starboard_messages_guild_original_unique` ON `starboard_messages` (`guild_id`,`original_message_id`);--> statement-breakpoint
CREATE INDEX `starboard_messages_star_count_idx` ON `starboard_messages` (`star_count`);