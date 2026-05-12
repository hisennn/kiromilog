CREATE TABLE "activity_like_notification_items" (
	"notification_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_like_notification_items_pk" PRIMARY KEY("notification_id","activity_id")
);
--> statement-breakpoint
CREATE TABLE "activity_like_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"latest_activity_id" uuid,
	"activity_count" integer DEFAULT 0 NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_like_notification_items" ADD CONSTRAINT "activity_like_notification_items_notification_id_activity_like_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."activity_like_notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_like_notification_items" ADD CONSTRAINT "activity_like_notification_items_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_like_notifications" ADD CONSTRAINT "activity_like_notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_like_notifications" ADD CONSTRAINT "activity_like_notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_like_notifications" ADD CONSTRAINT "activity_like_notifications_latest_activity_id_activities_id_fk" FOREIGN KEY ("latest_activity_id") REFERENCES "public"."activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_like_notification_items_activity_idx" ON "activity_like_notification_items" USING btree ("activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_like_notifications_recipient_actor_unique" ON "activity_like_notifications" USING btree ("recipient_id","actor_id");--> statement-breakpoint
CREATE INDEX "activity_like_notifications_recipient_read_idx" ON "activity_like_notifications" USING btree ("recipient_id","read_at","updated_at");