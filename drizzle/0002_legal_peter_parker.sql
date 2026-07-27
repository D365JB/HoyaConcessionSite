CREATE TABLE `cron_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`taskUid` varchar(128),
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cron_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `cron_jobs_name_unique` UNIQUE(`name`)
);
