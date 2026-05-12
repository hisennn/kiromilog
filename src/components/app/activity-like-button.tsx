"use client";

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
      <svg
        aria-hidden="true"
        fill={likeState.liked ? "currentColor" : "none"}
        height="16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="16"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M11.48 3.5a.58.58 0 0 1 1.04 0l2.18 4.42a.58.58 0 0 0 .44.32l4.88.71a.58.58 0 0 1 .32.99l-3.53 3.44a.58.58 0 0 0-.17.51l.83 4.86a.58.58 0 0 1-.84.61l-4.36-2.29a.58.58 0 0 0-.54 0l-4.36 2.29a.58.58 0 0 1-.84-.61l.83-4.86a.58.58 0 0 0-.17-.51L3.66 9.94a.58.58 0 0 1 .32-.99l4.88-.71a.58.58 0 0 0 .44-.32l2.18-4.42Z" />
      </svg>
      <span>{likeState.count}</span>
    </button>
  );
}
