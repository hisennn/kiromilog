import Image from "next/image";
import Link from "next/link";

import { ActivityLikeButton } from "@/components/app/activity-like-button";
import { getActivityActionText } from "@/lib/activity-copy";

type ActivityCardProps = {
  variant?: "feed" | "profile";
  activity: {
    id: string;
    kind: "anime_progress" | "manga_progress" | "anime_status" | "manga_status" | "favorite_added";
    mediaKind: "anime" | "manga" | null;
    mediaMalId: number | null;
    status: string | null;
    progressFrom: number | null;
    progressTo: number | null;
    title: string;
    imageUrl: string | null;
    relativeTime: string;
    username: string;
    nickname: string;
    avatarUrl?: string | null;
    likeCount: number;
    isLikedByViewer: boolean;
    isExplicitBlocked?: boolean;
  };
};

export function ActivityCard({ activity, variant = "feed" }: ActivityCardProps) {
  const mediaLink = activity.isExplicitBlocked
    ? "/settings"
    : activity.mediaKind && activity.mediaMalId
      ? `/${activity.mediaKind}/${activity.mediaMalId}`
      : "#";
  const actionText = getActivityActionText(activity);
  const imageClassName = `object-cover transition-transform duration-300 ${
    activity.isExplicitBlocked ? "blur-sm scale-110 opacity-50" : "group-hover:scale-105"
  }`;
  const title = activity.isExplicitBlocked ? "NSFW content" : activity.title;
  const badge = activity.isExplicitBlocked ? (
    <span className="absolute inset-0 grid place-items-center bg-black/35 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
      +18
    </span>
  ) : null;

  if (variant === "profile") {
    return (
      <article className="activity-card relative p-3 flex gap-4 items-center bg-transparent border border-line/40 transition-colors hover:border-line/80 group">
        <Link href={mediaLink} className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden bg-surface-strong">
          {activity.imageUrl ? (
            <Image alt={title} className={imageClassName} fill sizes="48px" src={activity.imageUrl} />
          ) : null}
          {badge}
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed truncate tracking-wide">
            <span className="text-muted mr-2 uppercase text-[11px] font-semibold tracking-wider">{actionText}</span>
            <Link href={mediaLink} className="text-primary font-medium hover:underline">{title}</Link>
          </p>
          <span className="text-xs text-muted block mt-1">{activity.relativeTime}</span>
        </div>
        <div className="activity-like-corner">
          <ActivityLikeButton
            activityId={activity.id}
            initialCount={activity.likeCount}
            initialLiked={activity.isLikedByViewer}
          />
        </div>
      </article>
    );
  }

  return (
    <article className="activity-card relative py-4 border-b border-line/30 last:border-0 sm:px-2 rounded-none transition-colors hover:bg-surface-strong/10">
      <div className="flex gap-4">
        <Link href={`/u/${activity.username}`} className="shrink-0 mt-0.5 group">
          {activity.avatarUrl ? (
            <div className="relative h-10 w-10 overflow-hidden ring-1 ring-line/50 transition-all group-hover:ring-primary/40">
              <Image alt={`@${activity.username}`} className="object-cover" fill sizes="40px" src={activity.avatarUrl} />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center bg-surface-strong ring-1 ring-line/50 transition-all group-hover:ring-primary/40 text-xs font-semibold text-foreground">
              {activity.username.slice(0, 1).toUpperCase()}
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <Link className="text-[15px] font-semibold text-foreground transition-colors hover:text-primary" href={`/u/${activity.username}`}>
                @{activity.username}
              </Link>
              <span className="text-sm text-muted">{actionText}</span>
            </div>
            <span className="text-xs text-muted/90 whitespace-nowrap shrink-0">{activity.relativeTime}</span>
          </div>

          <div className="flex gap-4 items-start">
            <Link href={mediaLink} className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden bg-surface-strong group">
              {activity.imageUrl ? (
                <Image alt={title} className={imageClassName} fill sizes="44px" src={activity.imageUrl} />
              ) : null}
              {badge}
            </Link>

            <div className="min-w-0 flex flex-col justify-center">
              <Link className="block truncate text-[15px] font-semibold text-primary transition-colors hover:underline" href={mediaLink}>
                {title}
              </Link>
              {activity.mediaKind && (
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted mt-1">{activity.mediaKind}</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="activity-like-corner">
        <ActivityLikeButton
          activityId={activity.id}
          initialCount={activity.likeCount}
          initialLiked={activity.isLikedByViewer}
        />
      </div>
    </article>
  );
}
