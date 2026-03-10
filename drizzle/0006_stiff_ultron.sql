ALTER TABLE `user_vocabulary` ADD `ease_factor` real DEFAULT 2.5 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_vocabulary` ADD `interval` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_vocabulary` ADD `repetition` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_vocabulary` ADD `next_review_at` integer;--> statement-breakpoint
ALTER TABLE `user_vocabulary` ADD `last_reviewed_at` integer;