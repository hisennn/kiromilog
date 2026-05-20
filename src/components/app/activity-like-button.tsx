"use client";

import { Star } from "iconoir-react";
import { useState, useTransition } from "react";

import { toggleActivityLikeAction } from "@/lib/activity-like-actions";

type ActivityLikeButtonProps = {
  activityId: string;
  initialLiked: boolean;
  initialCount: number;
};

type LikeState = {
  liked: boolean;
  count: number;
};

export function ActivityLikeButton({
  activityId,
  initialLiked,
  initialCount,
}: ActivityLikeButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [likeState, setLikeState] = useState<LikeState>({
    liked: initialLiked,
    count: initialCount,
  });

  function handleClick() {
    const previousState = likeState;
    const nextLiked = !likeState.liked;
    const nextCount = Math.max(0, likeState.count + (nextLiked ? 1 : -1));

    setLikeState({
      liked: nextLiked,
      count: nextCount,
    });

    startTransition(async () => {
      const formData = new FormData();
      formData.set("activityId", activityId);
      const result = await toggleActivityLikeAction(formData);

      if (result.ok) {
        setLikeState({
          liked: result.liked,
          count: result.likeCount,
        });
      } else {
        setLikeState(previousState);
      }
    });
  }

  return (
    <button
      aria-label={likeState.liked ? "Unlike post" : "Like post"}
      aria-pressed={likeState.liked}
      className={`activity-like-button ${likeState.liked ? "activity-like-button-active" : ""}`}
      disabled={isPending}
      onClick={handleClick}
      type="button"
    >
      <Star
        aria-hidden="true"
        fill={likeState.liked ? "currentColor" : "none"}
        width={16}
        height={16}
        strokeWidth={2}
      />
      <span>{likeState.count}</span>
    </button>
  );
}
