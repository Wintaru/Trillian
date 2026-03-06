PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_characters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`campaign_id` integer,
	`name` text NOT NULL,
	`metatype` text NOT NULL,
	`archetype` text,
	`body` integer DEFAULT 1 NOT NULL,
	`agility` integer DEFAULT 1 NOT NULL,
	`reaction` integer DEFAULT 1 NOT NULL,
	`strength` integer DEFAULT 1 NOT NULL,
	`willpower` integer DEFAULT 1 NOT NULL,
	`logic` integer DEFAULT 1 NOT NULL,
	`intuition` integer DEFAULT 1 NOT NULL,
	`charisma` integer DEFAULT 1 NOT NULL,
	`edge` integer DEFAULT 1 NOT NULL,
	`essence` text DEFAULT '6.0' NOT NULL,
	`magic` integer DEFAULT 0,
	`resonance` integer DEFAULT 0,
	`skills` text DEFAULT '[]' NOT NULL,
	`qualities` text DEFAULT '[]' NOT NULL,
	`spells` text DEFAULT '[]' NOT NULL,
	`gear` text DEFAULT '[]' NOT NULL,
	`contacts` text DEFAULT '[]' NOT NULL,
	`cyberware` text DEFAULT '[]' NOT NULL,
	`nuyen` integer DEFAULT 0 NOT NULL,
	`karma` integer DEFAULT 0 NOT NULL,
	`lifestyle` text DEFAULT 'squatter',
	`physical_cm_max` integer DEFAULT 10 NOT NULL,
	`physical_cm_current` integer DEFAULT 0 NOT NULL,
	`stun_cm_max` integer DEFAULT 10 NOT NULL,
	`stun_cm_current` integer DEFAULT 0 NOT NULL,
	`creation_status` text DEFAULT 'in_progress' NOT NULL,
	`creation_step` text DEFAULT 'metatype' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_characters`("id", "user_id", "campaign_id", "name", "metatype", "archetype", "body", "agility", "reaction", "strength", "willpower", "logic", "intuition", "charisma", "edge", "essence", "magic", "resonance", "skills", "qualities", "spells", "gear", "contacts", "cyberware", "nuyen", "karma", "lifestyle", "physical_cm_max", "physical_cm_current", "stun_cm_max", "stun_cm_current", "creation_status", "creation_step", "created_at", "updated_at") SELECT "id", "user_id", "campaign_id", "name", "metatype", "archetype", "body", "agility", "reaction", "strength", "willpower", "logic", "intuition", "charisma", "edge", "essence", "magic", "resonance", "skills", "qualities", "spells", "gear", "contacts", "cyberware", "nuyen", "karma", "lifestyle", "physical_cm_max", "physical_cm_current", "stun_cm_max", "stun_cm_current", "creation_status", "creation_step", "created_at", "updated_at" FROM `characters`;--> statement-breakpoint
DROP TABLE `characters`;--> statement-breakpoint
ALTER TABLE `__new_characters` RENAME TO `characters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;