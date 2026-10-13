CREATE TABLE `directory_login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `directory_login_attempts_expires_at_idx` ON `directory_login_attempts` (`expires_at`);--> statement-breakpoint
CREATE TABLE `directory_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`password_version` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `directory_sessions_expires_at_idx` ON `directory_sessions` (`expires_at`);--> statement-breakpoint
ALTER TABLE `links` ADD `listed` integer DEFAULT false NOT NULL;