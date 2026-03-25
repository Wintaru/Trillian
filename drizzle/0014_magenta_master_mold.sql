CREATE TABLE `birthdays` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`person_name` text,
	`month` integer NOT NULL,
	`day` integer NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `birthdays_guild_user_person_unique` ON `birthdays` (`guild_id`,`user_id`,`person_name`);--> statement-breakpoint
CREATE INDEX `birthdays_month_day_idx` ON `birthdays` (`month`,`day`);