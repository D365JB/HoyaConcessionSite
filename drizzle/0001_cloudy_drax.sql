CREATE TABLE `concession_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventDate` date NOT NULL,
	`label` varchar(128),
	`isActive` boolean NOT NULL DEFAULT true,
	`season` varchar(32) NOT NULL DEFAULT '2025',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `concession_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `volunteer_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`role` enum('co_cook','kitchen_assistant','runner','cashier') NOT NULL,
	`slotIndex` int NOT NULL,
	`isOpen` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `volunteer_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `volunteers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slotId` int NOT NULL,
	`eventId` int NOT NULL,
	`parentName` varchar(128) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`childName` varchar(128) NOT NULL,
	`sport` enum('football','cheer') NOT NULL,
	`grade` enum('K-1','2nd','3rd','4th','5th') NOT NULL,
	`status` enum('confirmed','checked_in','completed','no_show','canceled') NOT NULL DEFAULT 'confirmed',
	`reminderSent` boolean NOT NULL DEFAULT false,
	`confirmationSent` boolean NOT NULL DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `volunteers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `volunteer_slots` ADD CONSTRAINT `volunteer_slots_eventId_concession_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `concession_events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `volunteers` ADD CONSTRAINT `volunteers_slotId_volunteer_slots_id_fk` FOREIGN KEY (`slotId`) REFERENCES `volunteer_slots`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `volunteers` ADD CONSTRAINT `volunteers_eventId_concession_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `concession_events`(`id`) ON DELETE cascade ON UPDATE no action;