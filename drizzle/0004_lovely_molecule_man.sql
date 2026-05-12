CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"body" varchar(2000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_a_id" text NOT NULL,
	"participant_b_id" text NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_participant_a_id_users_id_fk" FOREIGN KEY ("participant_a_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_participant_b_id_users_id_fk" FOREIGN KEY ("participant_b_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_thread_created_at_idx" ON "chat_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_messages_sender_idx" ON "chat_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_threads_participants_unique" ON "chat_threads" USING btree ("participant_a_id","participant_b_id");--> statement-breakpoint
CREATE INDEX "chat_threads_participant_a_idx" ON "chat_threads" USING btree ("participant_a_id");--> statement-breakpoint
CREATE INDEX "chat_threads_participant_b_idx" ON "chat_threads" USING btree ("participant_b_id");--> statement-breakpoint
CREATE INDEX "chat_threads_last_message_at_idx" ON "chat_threads" USING btree ("last_message_at");