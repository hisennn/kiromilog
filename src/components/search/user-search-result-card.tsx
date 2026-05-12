import Image from "next/image";
import Link from "next/link";

type UserSearchResultCardProps = {
  user: {
    id: string;
    username: string;
    nickname: string;
    avatarUrl: string | null;
    bio: string | null;
    followers: number;
    following: number;
  };
};

export function UserSearchResultCard({ user }: UserSearchResultCardProps) {
  return (
    <Link
      className="search-result-card user-search-result-card group"
      href={`/u/${user.username}`}
    >
      <span className="user-search-avatar relative flex shrink-0 overflow-hidden border border-line bg-surface-strong">
        {user.avatarUrl ? (
          <Image
            alt={`@${user.username}`}
            className="object-cover"
            fill
            sizes="68px"
            src={user.avatarUrl}
          />
        ) : (
          <span className="grid h-full w-full place-items-center font-display text-2xl text-foreground">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>

      <span className="search-result-copy user-search-copy">
        <span className="min-w-0 space-y-1.5">
          <span className="block truncate font-display text-2xl leading-tight text-foreground transition-colors group-hover:text-primary">
            @{user.username}
          </span>
          {user.bio ? (
            <span className="line-clamp-2 block max-w-xl text-sm leading-6 text-muted">
              {user.bio}
            </span>
          ) : (
            <span className="block text-sm text-muted">View profile</span>
          )}
        </span>

        <span className="user-search-stats">
          <span className="user-search-stat">
            <strong>{user.followers}</strong>
            <span>followers</span>
          </span>
          <span className="user-search-stat">
            <strong>{user.following}</strong>
            <span>following</span>
          </span>
        </span>
      </span>
    </Link>
  );
}
