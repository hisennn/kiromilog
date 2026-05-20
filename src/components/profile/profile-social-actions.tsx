import { ChatBubble } from "iconoir-react";

import { startChatAction } from "@/lib/chat-actions";
import { toggleFollowAction } from "@/lib/social-actions";

type ProfileSocialActionsProps = {
  username: string;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMutual: boolean;
};

export function ProfileSocialActions({
  username,
  isFollowing,
  isFollowedBy,
  isMutual,
}: ProfileSocialActionsProps) {
  return (
    <div className="profile-action-row mt-5">
      <form action={toggleFollowAction} className="profile-follow-form">
        <input name="username" type="hidden" value={username} />
        <button
          className={`button profile-follow-button w-full justify-center ${
            isFollowing
              ? "button-ghost profile-following-button"
              : "button-primary"
          }`}
          type="submit"
        >
          <span className="profile-follow-label">
            {isFollowing ? "Following" : isFollowedBy ? "Follow back" : "Follow"}
          </span>
          {isFollowing ? (
            <span className="profile-unfollow-label">Unfollow</span>
          ) : null}
        </button>
      </form>

      {isMutual ? (
        <form action={startChatAction} className="profile-message-form">
          <input name="username" type="hidden" value={username} />
          <button
            aria-label="Message"
            className="button button-ghost profile-message-button"
            type="submit"
          >
            <ChatBubble aria-hidden="true" width={18} height={18} strokeWidth={2} />
          </button>
        </form>
      ) : null}
    </div>
  );
}
