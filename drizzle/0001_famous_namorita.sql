CREATE TABLE `plan_classes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`classNumber` int NOT NULL,
	`className` varchar(100),
	`uploadedFiles` json DEFAULT ('[]'),
	`analysisStatus` enum('pending','processing','done','error') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plan_classes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plan_students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classId` int NOT NULL,
	`planId` int NOT NULL,
	`studentName` varchar(255) NOT NULL,
	`examStatus` enum('did_exam','no_exam') NOT NULL DEFAULT 'no_exam',
	`projectStatus` enum('submitted','not_submitted') NOT NULL DEFAULT 'not_submitted',
	`rowNumber` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plan_students_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `treatment_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`teacherName` varchar(255) NOT NULL,
	`schoolName` varchar(255) NOT NULL,
	`principalName` varchar(255) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`classCount` int NOT NULL DEFAULT 1,
	`schoolLogoUrl` text,
	`academicYear` varchar(50) DEFAULT 'الثاني / 1446-1447هـ',
	`examLink` text,
	`projectLink` text,
	`examDuration` varchar(100),
	`projectDuration` varchar(100),
	`teacherNotes` text,
	`planType` enum('exam','project','both','other') NOT NULL DEFAULT 'both',
	`customPlanType` varchar(255),
	`status` enum('draft','processing','completed') NOT NULL DEFAULT 'draft',
	`pdfUrl` text,
	`docxUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `treatment_plans_id` PRIMARY KEY(`id`)
);
