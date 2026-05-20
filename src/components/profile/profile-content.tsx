"use client";

import { Check, Filter, MoreHoriz, Trash } from "iconoir-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ActivityCard } from "@/components/app/activity-card";
import { toast } from "@/components/app/toaster";
import {
  deleteLibraryEntryAction,
  saveAnimeEntryAction,
  saveMangaEntryAction,
} from "@/lib/library-actions";
import {
  AnimeTrackingForm,
  MangaTrackingForm,
  TrackingModalFrame,
} from "@/components/library/tracking-modal";

type ProfileView = "timeline" | "anime" | "manga" | "followers" | "following";

type ActivityItem = Parameters<typeof ActivityCard>[0]["activity"];

type LibraryEntry = {
  id: string;
  status: string;
  malId: number;
  title: string | null;
  imageUrl: string | null;
  score: number | null;
  progress: number;
  progressVolumes?: number;
  type: string | null;
  total: number | null;
  isFavorite?: boolean;
  isExplicitBlocked?: boolean;
};

type ProfileConnection = {
  id: string;
  username: string;
  nickname: string;
  avatarUrl: string | null;
};

type ProfileContentProps = {
  username: string;
  canEdit: boolean;
  initialView: ProfileView;
  initialFilter: string;
  feed: ActivityItem[];
  animeLibrary: LibraryEntry[];
  mangaLibrary: LibraryEntry[];
  connections: ProfileConnection[];
};

const ANIME_STATUS_GROUPS = [
  { value: "watching", label: "Watching" },
  { value: "completed", label: "Completed" },
  { value: "rewatching", label: "Rewatching" },
  { value: "paused", label: "Paused" },
  { value: "dropped", label: "Dropped" },
  { value: "plan_to_watch", label: "Planned" },
] as const;

const MANGA_STATUS_GROUPS = [
  { value: "reading", label: "Reading" },
  { value: "completed", label: "Completed" },
  { value: "rereading", label: "Rereading" },
  { value: "paused", label: "Paused" },
  { value: "dropped", label: "Dropped" },
  { value: "plan_to_read", label: "Planned" },
] as const;

function getLibraryEmptyStateCopy(
  activeView: "anime" | "manga",
  activeFilter: string,
  statusGroups: readonly { value: string; label: string }[],
) {
  const mediaLabel = activeView === "anime" ? "anime" : "manga";

  if (activeFilter === "all") {
    return {
      title: `No ${mediaLabel} saved`,
      description: "This list is still empty.",
    };
  }

  const activeGroup = statusGroups.find((group) => group.value === activeFilter);
  const filterLabel = activeGroup?.label.toLowerCase() ?? "selected";

  return {
    title: `No ${mediaLabel} here`,
    description: `There are no ${mediaLabel} entries in ${filterLabel}.`,
  };
}

function ProfileEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="panel flex min-h-52 items-center justify-center">
      <div className="mx-auto max-w-md space-y-2 text-center">
        <p className="eyebrow">{title}</p>
        <p className="text-sm leading-7 text-muted">{description}</p>
      </div>
    </article>
  );
}

function ProfileConnectionGrid({
  connections,
  activeView,
}: {
  connections: ProfileConnection[];
  activeView: "followers" | "following";
}) {
  if (!connections.length) {
    return (
      <ProfileEmptyState
        title={activeView === "followers" ? "No followers yet" : "Not following anyone yet"}
        description={
          activeView === "followers"
            ? "No one follows this profile yet."
            : "This profile is not following anyone yet."
        }
      />
    );
  }

  return (
    <div className="profile-social-grid">
      {connections.map((profile, index) => (
        <Link
          aria-label={`Open @${profile.username}`}
          className="profile-person-card animate-fade-in-up"
          data-title={`@${profile.username}`}
          href={`/u/${profile.username}`}
          key={profile.id}
          style={{ animationDelay: `${(index + 3) * 50}ms` }}
        >
          <span className="profile-person-avatar">
            {profile.avatarUrl ? (
              <Image
                alt=""
                className="profile-person-image"
                height={320}
                quality={90}
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 160px"
                src={profile.avatarUrl}
                width={240}
              />
            ) : (
              <span>{profile.username.slice(0, 1).toUpperCase()}</span>
            )}
          </span>
          <span className="profile-person-name">@{profile.username}</span>
        </Link>
      ))}
    </div>
  );
}

function formatProgress(entry: LibraryEntry) {
  if (entry.isExplicitBlocked) {
    return "-";
  }

  if (entry.total !== null && entry.status === "completed") {
    return String(entry.total);
  }

  if (entry.total !== null) {
    return `${entry.progress}/${entry.total}`;
  }

  return String(entry.progress);
}

function DeleteEntryDialog({
  entry,
  isDeleting,
  deleted,
  onCancel,
  onConfirm,
}: {
  entry: LibraryEntry;
  isDeleting: boolean;
  deleted: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="panel w-full max-w-sm animate-fade-in-up">
        <h3 className="mb-2 font-display text-xl text-foreground">Remove entry</h3>
        <p className="mb-6 text-sm text-muted">
          Remove <strong>{entry.title}</strong> from your list? This cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="button button-ghost"
            disabled={isDeleting || deleted}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting || deleted}
            className={`button flex items-center justify-center overflow-hidden transition-all duration-300 ${
              deleted
                ? "w-[112px] gap-2 border-transparent bg-[#d96b61] text-white"
                : "w-24 border border-[#d96b61]/20 bg-[#d96b61]/10 text-[#d96b61] hover:bg-[#d96b61]/20"
            }`}
          >
            {deleted ? (
              <>
                <Check width={16} height={16} strokeWidth={2.5} />
                <span className="text-sm font-medium">Removed</span>
              </>
            ) : isDeleting ? (
              <span className="inline-flex h-4 w-4 items-center justify-center" aria-label="Removing...">
                <span className="loading-spinner text-current" />
              </span>
            ) : (
              "Remove"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditLibraryEntryForm({
  entry,
  mediaType,
}: {
  entry: LibraryEntry;
  mediaType: "anime" | "manga";
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, startDeleting] = useTransition();
  const [deleted, setDeleted] = useState(false);
  const router = useRouter();

  const handleDelete = () => {
    startDeleting(async () => {
      const formData = new FormData();
      formData.append("mediaType", mediaType);
      formData.append("malId", String(entry.malId));
      await deleteLibraryEntryAction(formData);
      router.refresh();
      setDeleted(true);
      toast("Entry removed.", "danger");
      setTimeout(() => {
        setDeleted(false);
        setShowConfirm(false);
      }, 3000);
    });
  };

  return (
    <>
      {mediaType === "anime" ? (
        <AnimeTrackingForm
          action={saveAnimeEntryAction}
          malId={entry.malId}
          hasEntry={true}
          defaultStatus={entry.status}
          defaultScore={entry.score ?? ""}
          defaultProgress={entry.progress}
          maxEpisodes={entry.total}
          initialIsFavorite={entry.isFavorite ?? false}
        />
      ) : (
        <MangaTrackingForm
          action={saveMangaEntryAction}
          malId={entry.malId}
          hasEntry={true}
          initialIsFavorite={entry.isFavorite ?? false}
          defaultStatus={entry.status}
          defaultScore={entry.score ?? ""}
          defaultChapters={entry.progress}
          defaultVolumes={entry.progressVolumes ?? 0}
          maxChapters={entry.total}
          maxVolumes={null}
        />
      )}
      <div className="modal-danger-action">
        <button
          type="button"
          aria-label="Remove entry"
          className="modal-icon-button modal-icon-button-danger"
          onClick={() => setShowConfirm(true)}
        >
          <Trash width={19} height={19} strokeWidth={1.9} />
        </button>
      </div>

      {showConfirm && (
        <DeleteEntryDialog
          entry={entry}
          isDeleting={isDeleting}
          deleted={deleted}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}

function LibraryEntryRow({
  entry,
  activeView,
  modalId,
  canEdit,
}: {
  entry: LibraryEntry;
  activeView: "anime" | "manga";
  modalId: string;
  canEdit: boolean;
}) {
  const [openKey, setOpenKey] = useState(0);
  const entryHref = entry.isExplicitBlocked ? "/settings" : `/${activeView}/${entry.malId}`;
  const imageClassName = `library-cover-image object-cover ${
    entry.isExplicitBlocked ? "scale-110 blur-sm opacity-50" : ""
  }`;

  return (
    <div>
      <div className="library-grid library-row">
        <div className="library-title-cell">
          <div className="library-cover-cell">
            <div className="relative h-12 w-9 shrink-0 overflow-hidden border border-line bg-surface-strong">
              {entry.imageUrl ? (
                <Image
                  alt={entry.title ?? `${activeView} entry`}
                  className={imageClassName}
                  fill
                  sizes="36px"
                  src={entry.imageUrl}
                />
              ) : null}
              {entry.isExplicitBlocked ? (
                <span className="absolute inset-0 grid place-items-center bg-black/35 text-[9px] font-bold uppercase tracking-[0.16em] text-white">
                  +18
                </span>
              ) : null}
              {canEdit && !entry.isExplicitBlocked ? (
                <span aria-hidden="true" className="library-cover-overlay">
                  <MoreHoriz width={16} height={16} strokeWidth={2} />
                </span>
              ) : null}
              {canEdit && !entry.isExplicitBlocked ? (
                <a
                  aria-label={`Edit ${entry.title ?? `MAL ${entry.malId}`}`}
                  className="library-cover-button"
                  onClick={() => setOpenKey((k) => k + 1)}
                  href={`#${modalId}`}
                />
              ) : null}
            </div>
          </div>
          <Link
            className="truncate text-sm text-foreground transition-colors hover:text-primary"
            href={entryHref}
          >
            {entry.title ?? `MAL ${entry.malId}`}
          </Link>
        </div>

        <div className="library-meta-cell">{entry.isExplicitBlocked ? "-" : entry.score ?? "-"}</div>
        <div className="library-meta-cell">{formatProgress(entry)}</div>
        <div className="library-meta-cell">{entry.isExplicitBlocked ? "-" : entry.type ?? "-"}</div>
      </div>

      {canEdit && !entry.isExplicitBlocked ? (
        <TrackingModalFrame
          modalId={modalId}
          title={entry.title ?? `MAL ${entry.malId}`}
          imageUrl={entry.imageUrl}
        >
          <EditLibraryEntryForm
            key={openKey}
            entry={entry}
            mediaType={activeView}
          />
        </TrackingModalFrame>
      ) : null}
    </div>
  );
}

export function ProfileContent({
  username,
  canEdit,
  initialView,
  initialFilter,
  feed,
  animeLibrary,
  mangaLibrary,
  connections,
}: ProfileContentProps) {
  const filterRef = useRef<HTMLDetailsElement>(null);
  const activeView = initialView;
  const activeFilter = initialFilter;
  const isLibraryView = activeView === "anime" || activeView === "manga";
  const statusGroups = activeView === "anime" ? ANIME_STATUS_GROUPS : MANGA_STATUS_GROUPS;
  const library = activeView === "anime" ? animeLibrary : activeView === "manga" ? mangaLibrary : [];
  const visibleFeed = feed.filter((activity) => activity.title.trim().length > 0);
  const visibleEntries =
    isLibraryView
      ? library
          .filter((entry) => activeFilter === "all" || entry.status === activeFilter)
          .sort((left, right) => {
            if (activeView !== "anime") {
              return 0;
            }

            const leftScore = left.score ?? -1;
            const rightScore = right.score ?? -1;

            if (leftScore !== rightScore) {
              return rightScore - leftScore;
            }

            return (left.title ?? "").localeCompare(right.title ?? "");
          })
      : library
          .slice(0, 0);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!filterRef.current?.open) {
        return;
      }

      if (!filterRef.current.contains(event.target as Node)) {
        filterRef.current.open = false;
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function getProfileHref(view: ProfileView, filter = "all") {
    const params = new URLSearchParams();

    if (view !== "timeline") {
      params.set("view", view);
    }

    if ((view === "anime" || view === "manga") && filter !== "all") {
      params.set("filter", filter);
    }

    const query = params.toString();

    return query ? `/u/${username}?${query}` : `/u/${username}`;
  }

  return (
    <section className="space-y-4">
      <div className="section-head animate-fade-in-up animate-delay-200">
        <div className="profile-library-head">
          <p className="eyebrow">Library</p>
          <div className="profile-view-controls">
            <nav className="profile-toggle-groups">
              <span className="search-toggle">
                <Link className={`search-toggle-button ${activeView === "timeline" ? "search-toggle-button-active" : ""}`} href={getProfileHref("timeline")}>
                  Activity
                </Link>
                <Link className={`search-toggle-button ${activeView === "anime" ? "search-toggle-button-active" : ""}`} href={getProfileHref("anime")}>
                  Anime list
                </Link>
                <Link className={`search-toggle-button ${activeView === "manga" ? "search-toggle-button-active" : ""}`} href={getProfileHref("manga")}>
                  Manga list
                </Link>
              </span>
              <span className="search-toggle">
                <Link className={`search-toggle-button ${activeView === "followers" ? "search-toggle-button-active" : ""}`} href={getProfileHref("followers")}>
                  Followers
                </Link>
                <Link className={`search-toggle-button ${activeView === "following" ? "search-toggle-button-active" : ""}`} href={getProfileHref("following")}>
                  Following
                </Link>
              </span>
            </nav>
          </div>
        </div>

        <div className="profile-filter-row">
          {activeView === "anime" || activeView === "manga" ? (
            <details className="profile-filter-dropdown" ref={filterRef}>
              <summary className="button button-ghost profile-filter-trigger flex items-center gap-2">
                <Filter width={16} height={16} strokeWidth={2} />
                Filter
              </summary>
              <div className="profile-filter-menu panel">
                <Link className={`profile-filter-link ${activeFilter === "all" ? "profile-filter-link-active" : ""}`} href={getProfileHref(activeView)}>
                  All
                </Link>
                {statusGroups.map((group) => (
                  <Link
                    className={`profile-filter-link ${activeFilter === group.value ? "profile-filter-link-active" : ""}`}
                    href={getProfileHref(activeView, group.value)}
                    key={group.value}
                  >
                    {group.label}
                  </Link>
                ))}
              </div>
            </details>
          ) : (
            <div aria-hidden="true" className="profile-filter-placeholder" />
          )}
        </div>
      </div>

      {activeView === "timeline" ? (
        visibleFeed.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleFeed.map((activity, index) => (
              <div key={activity.id} className="animate-fade-in-up" style={{ animationDelay: `${(index + 3) * 50}ms` }}>
                <ActivityCard activity={activity} variant="profile" />
              </div>
            ))}
          </div>
        ) : (
          <ProfileEmptyState
            title="No activity yet"
            description="There is no public activity here yet."
          />
        )
      ) : activeView === "followers" || activeView === "following" ? (
        <ProfileConnectionGrid
          activeView={activeView}
          connections={connections}
        />
      ) : visibleEntries.length ? (
        <div className="space-y-6 profile-library-stack">
          {statusGroups.map((group) => {
            const entries = visibleEntries.filter((entry) => entry.status === group.value);

            if (!entries.length) {
              return null;
            }

            return (
              <section className="space-y-2" key={group.value}>
                <p className="library-section-label">{group.label}</p>

                <article className="panel space-y-3">
                  <div className="library-grid library-list-head">
                    <div className="library-title-head">Title</div>
                    <div className="library-list-meta-column">Score</div>
                    <div className="library-list-meta-column">Progress</div>
                    <div className="library-list-meta-column">Type</div>
                  </div>

                  <div className="space-y-1">
                    {entries.map((entry) => {
                      const modalId = `edit-${activeView}-${entry.malId}`;
                      return (
                        <LibraryEntryRow
                          key={entry.id}
                          entry={entry}
                          activeView={activeView as "anime" | "manga"}
                          modalId={modalId}
                          canEdit={canEdit}
                        />
                      );
                    })}
                  </div>
                </article>
              </section>
            );
          })}
        </div>
      ) : (
        <ProfileEmptyState
          {...getLibraryEmptyStateCopy(
            activeView,
            activeFilter,
            statusGroups,
          )}
        />
      )}
    </section>
  );
}







