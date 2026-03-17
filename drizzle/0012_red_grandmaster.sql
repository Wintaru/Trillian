CREATE TABLE `library_books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`isbn` text NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`cover_url` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`page_count` integer DEFAULT 0 NOT NULL,
	`publish_year` integer DEFAULT 0 NOT NULL,
	`genres` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_books_isbn_unique` ON `library_books` (`isbn`);--> statement-breakpoint
CREATE TABLE `library_borrows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`library_entry_id` integer NOT NULL,
	`borrower_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`borrowed_at` integer NOT NULL,
	`approved_at` integer,
	`due_date` integer,
	`returned_at` integer,
	`last_reminder_at` integer
);
--> statement-breakpoint
CREATE INDEX `library_borrows_entry_status_idx` ON `library_borrows` (`library_entry_id`,`status`);--> statement-breakpoint
CREATE INDEX `library_borrows_borrower_status_idx` ON `library_borrows` (`borrower_id`,`status`);--> statement-breakpoint
CREATE TABLE `library_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`guild_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`condition` text DEFAULT 'good' NOT NULL,
	`availability_type` text DEFAULT 'lend' NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`added_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `library_entries_guild_status_idx` ON `library_entries` (`guild_id`,`status`);--> statement-breakpoint
CREATE INDEX `library_entries_owner_guild_idx` ON `library_entries` (`owner_id`,`guild_id`);--> statement-breakpoint
CREATE TABLE `library_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`review` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_reviews_book_guild_user_unique` ON `library_reviews` (`book_id`,`guild_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `library_wishlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`isbn` text,
	`title` text DEFAULT '' NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`added_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_wishlist_guild_user_isbn_unique` ON `library_wishlist` (`guild_id`,`user_id`,`isbn`);