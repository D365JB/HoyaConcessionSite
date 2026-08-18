ALTER TABLE `concession_events` ADD `eventType` text DEFAULT 'practice' NOT NULL;--> statement-breakpoint
ALTER TABLE `volunteer_slots` ADD `startTime` text;--> statement-breakpoint
ALTER TABLE `volunteer_slots` ADD `endTime` text;