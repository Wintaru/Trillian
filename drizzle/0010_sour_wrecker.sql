CREATE TABLE `recipe_ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`name` text NOT NULL,
	`quantity` text
);
--> statement-breakpoint
CREATE INDEX `recipe_ingredients_recipe_id_idx` ON `recipe_ingredients` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `recipe_ingredients_name_idx` ON `recipe_ingredients` (`name`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`instructions` text NOT NULL,
	`source_url` text,
	`created_at` integer NOT NULL
);
