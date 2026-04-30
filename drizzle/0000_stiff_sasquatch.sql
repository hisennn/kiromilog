CREATE TYPE "public"."activity_kind" AS ENUM('anime_progress', 'manga_progress', 'anime_status', 'manga_status', 'favorite_added');--> statement-breakpoint
CREATE TYPE "public"."anime_list_status" AS ENUM('watching', 'completed', 'rewatching', 'dropped', 'plan_to_watch');--> statement-breakpoint
CREATE TYPE "public"."manga_list_status" AS ENUM('reading', 'completed', 'rereading', 'dropped', 'plan_to_read');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('anime', 'manga');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text NOT NULL,
	"kind" "activity_kind" NOT NULL,
	"media_kind" "media_kind",
	"media_mal_id" integer,
	"list_entry_id" uuid,
	"status" text,
	"progress_from" integer,
	"progress_to" integer,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_likes" (
	"activity_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_likes_pk" PRIMARY KEY("activity_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "anime_cache" (
	"mal_id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"title_english" text,
	"title_japanese" text,
	"image_url" text,
	"synopsis" text,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_cache" (
	"mal_id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite_anime" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"mal_id" integer NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"mal_id" integer NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite_manga" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"mal_id" integer NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manga_cache" (
	"mal_id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"title_english" text,
	"title_japanese" text,
	"image_url" text,
	"synopsis" text,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_anime_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"mal_id" integer NOT NULL,
	"status" "anime_list_status" NOT NULL,
	"score" integer,
	"progress_episodes" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_follows_pk" PRIMARY KEY("follower_id","following_id")
);
--> statement-breakpoint
CREATE TABLE "user_manga_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"mal_id" integer NOT NULL,
	"status" "manga_list_status" NOT NULL,
	"score" integer,
	"progress_chapters" integer DEFAULT 0 NOT NULL,
	"progress_volumes" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" varchar(30) NOT NULL,
	"nickname" varchar(50) NOT NULL,
	"avatar_url" text,
	"avatar_path" text,
	"bio" varchar(280),
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_likes" ADD CONSTRAINT "activity_likes_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_likes" ADD CONSTRAINT "activity_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_anime" ADD CONSTRAINT "favorite_anime_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_characters" ADD CONSTRAINT "favorite_characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_manga" ADD CONSTRAINT "favorite_manga_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_anime_list" ADD CONSTRAINT "user_anime_list_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_manga_list" ADD CONSTRAINT "user_manga_list_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_actor_created_at_idx" ON "activities" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "activities_media_lookup_idx" ON "activities" USING btree ("actor_id","media_kind","media_mal_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_likes_user_idx" ON "activity_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "anime_cache_cached_at_idx" ON "anime_cache" USING btree ("cached_at");--> statement-breakpoint
CREATE INDEX "character_cache_cached_at_idx" ON "character_cache" USING btree ("cached_at");--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_anime_user_mal_unique" ON "favorite_anime" USING btree ("user_id","mal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_anime_user_position_unique" ON "favorite_anime" USING btree ("user_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_characters_user_mal_unique" ON "favorite_characters" USING btree ("user_id","mal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_characters_user_position_unique" ON "favorite_characters" USING btree ("user_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_manga_user_mal_unique" ON "favorite_manga" USING btree ("user_id","mal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_manga_user_position_unique" ON "favorite_manga" USING btree ("user_id","position");--> statement-breakpoint
CREATE INDEX "manga_cache_cached_at_idx" ON "manga_cache" USING btree ("cached_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_anime_list_user_id_mal_id_unique" ON "user_anime_list" USING btree ("user_id","mal_id");--> statement-breakpoint
CREATE INDEX "user_anime_list_user_status_idx" ON "user_anime_list" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_anime_list_mal_id_idx" ON "user_anime_list" USING btree ("mal_id");--> statement-breakpoint
CREATE INDEX "user_follows_following_idx" ON "user_follows" USING btree ("following_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_manga_list_user_id_mal_id_unique" ON "user_manga_list" USING btree ("user_id","mal_id");--> statement-breakpoint
CREATE INDEX "user_manga_list_user_status_idx" ON "user_manga_list" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_manga_list_mal_id_idx" ON "user_manga_list" USING btree ("mal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");