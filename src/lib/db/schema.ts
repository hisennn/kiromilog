import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { animeStatusValues, mangaStatusValues } from "@/lib/library-status";
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
};

export const animeListStatusEnum = pgEnum("anime_list_status", animeStatusValues);

export const mangaListStatusEnum = pgEnum("manga_list_status", mangaStatusValues);

export const mediaKindEnum = pgEnum("media_kind", ["anime", "manga"]);

export const activityKindEnum = pgEnum("activity_kind", [
  "anime_progress",
  "manga_progress",
  "anime_status",
  "manga_status",
  "favorite_added",
]);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    username: varchar("username", { length: 30 }).notNull(),
    nickname: varchar("nickname", { length: 50 }).notNull(),
    avatarUrl: text("avatar_url"),
    avatarPath: text("avatar_path"),
    avatarMaxUploadMb: integer("avatar_max_upload_mb").default(5).notNull(),
    showAdultContent: boolean("show_adult_content").default(false).notNull(),
    bio: varchar("bio", { length: 280 }),
    onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_username_unique").on(table.username),
  ],
);

export const userFollows = pgTable(
  "user_follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.followerId, table.followingId],
      name: "user_follows_pk",
    }),
    index("user_follows_following_idx").on(table.followingId),
  ],
);

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").default(0).notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    participantAId: text("participant_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    participantBId: text("participant_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", {
      withTimezone: true,
      mode: "date",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("chat_threads_participants_unique").on(
      table.participantAId,
      table.participantBId,
    ),
    index("chat_threads_participant_a_idx").on(table.participantAId),
    index("chat_threads_participant_b_idx").on(table.participantBId),
    index("chat_threads_last_message_at_idx").on(table.lastMessageAt),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 2000 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chat_messages_thread_created_at_idx").on(
      table.threadId,
      table.createdAt,
    ),
    index("chat_messages_sender_idx").on(table.senderId),
  ],
);

export const animeCache = pgTable(
  "anime_cache",
  {
    malId: integer("mal_id").primaryKey(),
    title: text("title").notNull(),
    titleEnglish: text("title_english"),
    titleJapanese: text("title_japanese"),
    imageUrl: text("image_url"),
    synopsis: text("synopsis"),
    payload: jsonb("payload").notNull(),
    cachedAt: timestamp("cached_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [index("anime_cache_cached_at_idx").on(table.cachedAt)],
);

export const mangaCache = pgTable(
  "manga_cache",
  {
    malId: integer("mal_id").primaryKey(),
    title: text("title").notNull(),
    titleEnglish: text("title_english"),
    titleJapanese: text("title_japanese"),
    imageUrl: text("image_url"),
    synopsis: text("synopsis"),
    payload: jsonb("payload").notNull(),
    cachedAt: timestamp("cached_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [index("manga_cache_cached_at_idx").on(table.cachedAt)],
);

export const characterCache = pgTable(
  "character_cache",
  {
    malId: integer("mal_id").primaryKey(),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    payload: jsonb("payload").notNull(),
    cachedAt: timestamp("cached_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [index("character_cache_cached_at_idx").on(table.cachedAt)],
);

export const userAnimeList = pgTable(
  "user_anime_list",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    malId: integer("mal_id").notNull(),
    status: animeListStatusEnum("status").notNull(),
    score: integer("score"),
    progressEpisodes: integer("progress_episodes").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_anime_list_user_id_mal_id_unique").on(
      table.userId,
      table.malId,
    ),
    index("user_anime_list_user_status_idx").on(table.userId, table.status),
    index("user_anime_list_mal_id_idx").on(table.malId),
  ],
);

export const userMangaList = pgTable(
  "user_manga_list",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    malId: integer("mal_id").notNull(),
    status: mangaListStatusEnum("status").notNull(),
    score: integer("score"),
    progressChapters: integer("progress_chapters").default(0).notNull(),
    progressVolumes: integer("progress_volumes").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_manga_list_user_id_mal_id_unique").on(
      table.userId,
      table.malId,
    ),
    index("user_manga_list_user_status_idx").on(table.userId, table.status),
    index("user_manga_list_mal_id_idx").on(table.malId),
  ],
);

export const favoriteAnime = pgTable(
  "favorite_anime",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    malId: integer("mal_id").notNull(),
    position: integer("position").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("favorite_anime_user_mal_unique").on(table.userId, table.malId),
    uniqueIndex("favorite_anime_user_position_unique").on(
      table.userId,
      table.position,
    ),
  ],
);

export const favoriteManga = pgTable(
  "favorite_manga",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    malId: integer("mal_id").notNull(),
    position: integer("position").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("favorite_manga_user_mal_unique").on(table.userId, table.malId),
    uniqueIndex("favorite_manga_user_position_unique").on(
      table.userId,
      table.position,
    ),
  ],
);

export const favoriteCharacters = pgTable(
  "favorite_characters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    malId: integer("mal_id").notNull(),
    position: integer("position").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("favorite_characters_user_mal_unique").on(
      table.userId,
      table.malId,
    ),
    uniqueIndex("favorite_characters_user_position_unique").on(
      table.userId,
      table.position,
    ),
  ],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: activityKindEnum("kind").notNull(),
    mediaKind: mediaKindEnum("media_kind"),
    mediaMalId: integer("media_mal_id"),
    listEntryId: uuid("list_entry_id"),
    status: text("status"),
    progressFrom: integer("progress_from"),
    progressTo: integer("progress_to"),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("activities_actor_created_at_idx").on(table.actorId, table.createdAt),
    index("activities_media_lookup_idx").on(
      table.actorId,
      table.mediaKind,
      table.mediaMalId,
      table.createdAt,
    ),
  ],
);

export const activityLikes = pgTable(
  "activity_likes",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.activityId, table.userId],
      name: "activity_likes_pk",
    }),
    index("activity_likes_user_idx").on(table.userId),
  ],
);

export const activityLikeNotifications = pgTable(
  "activity_like_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    latestActivityId: uuid("latest_activity_id").references(() => activities.id, {
      onDelete: "set null",
    }),
    activityCount: integer("activity_count").default(0).notNull(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("activity_like_notifications_recipient_actor_unique").on(
      table.recipientId,
      table.actorId,
    ),
    index("activity_like_notifications_recipient_read_idx").on(
      table.recipientId,
      table.readAt,
      table.updatedAt,
    ),
  ],
);

export const activityLikeNotificationItems = pgTable(
  "activity_like_notification_items",
  {
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => activityLikeNotifications.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.notificationId, table.activityId],
      name: "activity_like_notification_items_pk",
    }),
    index("activity_like_notification_items_activity_idx").on(table.activityId),
  ],
);



