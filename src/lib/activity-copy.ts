export type ActivityCopyInput = {
  kind: "anime_progress" | "manga_progress" | "anime_status" | "manga_status" | "favorite_added";
  mediaKind: "anime" | "manga" | null;
  status: string | null;
  progressFrom: number | null;
  progressTo: number | null;
  title?: string | null;
};

export function getActivityActionText(activity: ActivityCopyInput) {
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
      return `read ch ${activity.progressFrom + 1}-${activity.progressTo}`;
    }

    if (activity.progressTo) {
      return `read ch ${activity.progressTo}`;
    }
  }

  if (activity.kind === "anime_status" || activity.kind === "manga_status") {
    const listType = activity.kind === "anime_status" ? "anime" : "manga";

    if (activity.status === "completed") return "completed";
    if (activity.status === "watching") return "is watching";
    if (activity.status === "reading") return "is reading";
    if (activity.status === "paused") return "paused";
    if (activity.status === "dropped") return "dropped";
    if (activity.status === "plan_to_watch") return "plans to watch";
    if (activity.status === "plan_to_read") return "plans to read";
    if (activity.status === "rewatching") return "is rewatching";
    if (activity.status === "rereading") return "is rereading";

    return `added to ${listType} list`;
  }

  return "favorited";
}

export function getActivitySummaryText(activity: ActivityCopyInput) {
  const title = activity.title?.trim();
  const action = getActivityActionText(activity);

  return title ? `${action} ${title}` : action;
}
