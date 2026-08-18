CREATE TABLE `concession_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eventDate` text NOT NULL,
	`label` text,
	`location` text,
	`isActive` integer DEFAULT true NOT NULL,
	`season` text DEFAULT '2025' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cron_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`taskUid` text,
	`description` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cron_jobs_name_unique` ON `cron_jobs` (`name`);--> statement-breakpoint
CREATE TABLE `local_admin_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`email` text NOT NULL,
	`passwordHash` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_admin_accounts_userId_unique` ON `local_admin_accounts` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `local_admin_accounts_email_unique` ON `local_admin_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`lastSignedIn` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);--> statement-breakpoint
CREATE TABLE `volunteer_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eventId` integer NOT NULL,
	`role` text NOT NULL,
	`slotIndex` integer NOT NULL,
	`isOpen` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `concession_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `volunteers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slotId` integer NOT NULL,
	`eventId` integer NOT NULL,
	`parentName` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`childName` text NOT NULL,
	`sport` text NOT NULL,
	`grade` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`reminderSent` integer DEFAULT false NOT NULL,
	`confirmationSent` integer DEFAULT false NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`slotId`) REFERENCES `volunteer_slots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`eventId`) REFERENCES `concession_events`(`id`) ON UPDATE no action ON DELETE cascade
);
