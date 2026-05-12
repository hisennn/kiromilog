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
            <svg
              aria-hidden="true"
              fill="none"
              height="18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="18"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
            </svg>
          </button>
        </form>
      ) : null}
    </div>
  );
}
