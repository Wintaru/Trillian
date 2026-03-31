CREATE TABLE `reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`user_id` text NOT NULL,
	`message` text NOT NULL,
	`deliver_at` integer NOT NULL,
	`is_public` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`delivered_at` integer
);
--> statement-breakpoint
CREATE INDEX `reminders_status_deliver_at_idx` ON `reminders` (`status`,`deliver_at`);--> statement-breakpoint
CREATE INDEX `reminders_user_status_idx` ON `reminders` (`user_id`,`status`);