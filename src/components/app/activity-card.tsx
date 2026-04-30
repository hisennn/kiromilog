import Image from "next/image";
import Link from "next/link";

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
  };
};

function getActivityAction(activity: ActivityCardProps["activity"]) {
  if (activity.kind === "anime_progress") {
    if (activity.progressFrom && activity.progressTo && activity.progressTo > activity.progressFrom + 1) {
      return `watched eps ${activity.progressFrom + 1}-${activity.progressTo}`;
    }

    if (activity.progressTo) {
      return `watched ep ${activity.progressTo}`;
    }
  }

  if (activity.kind === "manga_progress") {
    if (activity.progressFrom && activity.progressTo && activity.progressTo > activity.progressFrom + 1) {
      return `read chs ${activity.progressFrom + 1}-${activity.progressTo}`;
    }

    if (activity.progressTo) {
      return `read ch ${activity.progressTo}`;
    }
  }

  if (activity.kind === "anime_status" || activity.kind === "manga_status") {
    const listType = activity.kind === "anime_status" ? "anime" : "manga";

    if (activity.status === "completed") return "completed";
    if (activity.status === "watching") return "watching";
    if (activity.status === "reading") return "reading";
    if (activity.status === "paused") return "paused";
    if (activity.status === "dropped") return "dropped";
    if (activity.status === "plan_to_watch") return "plans to watch";
    if (activity.status === "plan_to_read") return "plans to read";
    if (activity.status === "rewatching") return "rewatching";
    if (activity.status === "rereading") return "rereading";

    return `added to their ${listType} list`;
  }

  return "favorited";
}

export function ActivityCard({ activity, variant = "feed" }: ActivityCardProps) {
  const mediaLink = activity.mediaKind && activity.mediaMalId ? `/${activity.mediaKind}/${activity.mediaMalId}` : "#";
  const actionText = getActivityAction(activity);

  if (variant === "profile") {
    return (
      <article className="activity-card p-3 flex gap-4 items-center bg-transparent border border-line/40 transition-colors hover:border-line/80 group">
        <Link href={mediaLink} className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden bg-surface-strong">
          {activity.imageUrl ? (
            <Image alt={activity.title} className="object-cover transition-transform group-hover:scale-105 duration-300" fill sizes="48px" src={activity.imageUrl} />
          ) : null}
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed truncate tracking-wide">
            <span className="text-muted mr-2 uppercase text-[11px] font-semibold tracking-wider">{actionText}</span>
            <Link href={mediaLink} className="text-primary font-medium hover:underline">{activity.title}</Link>
          </p>
          <span className="text-xs text-muted block mt-1">{activity.relativeTime}</span>
        </div>
      </article>
    );
  }

  return (
    <article className="activity-card py-4 border-b border-line/30 last:border-0 sm:px-2 rounded-none transition-colors hover:bg-surface-strong/10">
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
                <Image alt={activity.title} className="object-cover transition-transform group-hover:scale-105 duration-300" fill sizes="44px" src={activity.imageUrl} />
              ) : null}
            </Link>

            <div className="min-w-0 flex flex-col justify-center">
              <Link className="block truncate text-[15px] font-semibold text-primary transition-colors hover:underline" href={mediaLink}>
                {activity.title}
              </Link>
              {activity.mediaKind && (
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted mt-1">{activity.mediaKind}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
