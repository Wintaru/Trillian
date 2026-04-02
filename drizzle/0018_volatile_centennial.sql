CREATE TABLE `feed_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`feed_url` text NOT NULL,
	`label` text NOT NULL,
	`last_post_guid` text,
	`last_checked_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feed_subscriptions_guild_url_unique` ON `feed_subscriptions` (`guild_id`,`feed_url`);--> statement-breakpoint
CREATE INDEX `feed_subscriptions_guild_idx` ON `feed_subscriptions` (`guild_id`);