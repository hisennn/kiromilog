CREATE TABLE "account_deletion_jobs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"avatar_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
