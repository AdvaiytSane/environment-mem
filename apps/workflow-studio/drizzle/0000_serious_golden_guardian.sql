CREATE TABLE `retrieval_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`workflow_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `receipts_workflow` ON `retrieval_receipts` (`owner`,`workflow_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `workflow_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`workflow_id` text NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_version` ON `workflow_revisions` (`owner`,`workflow_id`,`version`);--> statement-breakpoint
CREATE INDEX `workflow_owner` ON `workflow_revisions` (`owner`,`created_at`);--> statement-breakpoint
CREATE TABLE `observed_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`workflow_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runs_workflow` ON `observed_runs` (`owner`,`workflow_id`,`created_at`);