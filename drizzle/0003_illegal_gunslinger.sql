CREATE TABLE `local_admin_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `local_admin_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_admin_accounts_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `local_admin_accounts_email_unique` UNIQUE(`email`)
);
