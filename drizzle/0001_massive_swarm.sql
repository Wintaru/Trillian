CREATE TABLE `poll_votes` (
	`poll_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`option_index` integer NOT NULL,
	PRIMARY KEY(`poll_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `polls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text DEFAULT '' NOT NULL,
	`creator_id` text NOT NULL,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`closes_at` integer,
	`created_at` integer NOT NULL
);
