import Image from "next/image";
import Link from "next/link";

import { ActivityCard } from "@/components/app/activity-card";
import { ModalForm } from "@/components/shared/modal-form";
import {
  deleteLibraryEntryAction,
  saveAnimeEntryAction,
  saveMangaEntryAction,
} from "@/lib/library-actions";

type ProfileView = "timeline" | "anime" | "manga";

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
};

type ProfileContentProps = {
  username: string;
  initialView: ProfileView;
  initialFilter: string;
  feed: ActivityItem[];
  animeLibrary: LibraryEntry[];
  mangaLibrary: LibraryEntry[];
};

const VIEW_LABELS: Record<ProfileView, string> = {
  timeline: "Timeline",
  anime: "Anime list",
  manga: "Manga list",
};

const ANIME_STATUS_GROUPS = [
  { value: "watching", label: "Watching" },
  { value: "completed", label: "Completed" },
  { value: "rewatching", label: "Rewatching" },
  { value: "dropped", label: "Dropped" },
  { value: "plan_to_watch", label: "Planning" },
] as const;

const MANGA_STATUS_GROUPS = [
  { value: "reading", label: "Reading" },
  { value: "completed", label: "Completed" },
  { value: "rereading", label: "Rereading" },
  { value: "dropped", label: "Dropped" },
  { value: "plan_to_read", label: "Planning" },
] as const;

function formatProgress(entry: LibraryEntry) {
  if (entry.total !== null && entry.status === "completed") {
    return String(entry.total);
  }

  if (entry.total !== null) {
    return `${entry.progress}/${entry.total}`;
  }

  return String(entry.progress);
}

export function ProfileContent({
  username,
  initialView,
  initialFilter,
  feed,
  animeLibrary,
  mangaLibrary,
}: ProfileContentProps) {
  const activeView = initialView;
  const activeFilter = initialFilter;
  const statusGroups = activeView === "anime" ? ANIME_STATUS_GROUPS : MANGA_STATUS_GROUPS;
  const library = activeView === "anime" ? animeLibrary : mangaLibrary;
  const visibleEntries =
    activeView === "timeline"
      ? []
      : library.filter((entry) => activeFilter === "all" || entry.status === activeFilter);

  function getProfileHref(view: ProfileView, filter = "all") {
    const params = new URLSearchParams();

    if (view !== "timeline") {
      params.set("view", view);
    }

    if (view !== "timeline" && filter !== "all") {
      params.set("filter", filter);
    }

    const query = params.toString();

    return query ? `/u/${username}?${query}` : `/u/${username}`;
  }

  return (
    <section className="space-y-4">
      <div className="section-head animate-fade-in-up animate-delay-200">
        <div>
          <p className="eyebrow">Library</p>
          <h2 className="font-display text-3xl text-foreground">{VIEW_LABELS[activeView]}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav className="search-toggle">
            <Link className={`search-toggle-button ${activeView === "timeline" ? "search-toggle-button-active" : ""}`} href={getProfileHref("timeline")}>
              Timeline
            </Link>
            <Link className={`search-toggle-button ${activeView === "anime" ? "search-toggle-button-active" : ""}`} href={getProfileHref("anime")}>
              Anime list
            </Link>
            <Link className={`search-toggle-button ${activeView === "manga" ? "search-toggle-button-active" : ""}`} href={getProfileHref("manga")}>
              Manga list
            </Link>
          </nav>

          {activeView !== "timeline" ? (
            <details className="profile-filter-dropdown">
              <summary className="button button-ghost profile-filter-trigger">Filter</summary>
              <div className="profile-filter-menu panel">
                <Link className={`profile-filter-link ${activeFilter === "all" ? "profile-filter-link-active" : ""}`} href={getProfileHref(activeView)}>
                  All statuses
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
          ) : null}
        </div>
      </div>

      {activeView === "timeline" ? (
        feed.filter(a => a.status !== "plan_to_watch" && a.status !== "plan_to_read").length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {feed.filter(a => a.status !== "plan_to_watch" && a.status !== "plan_to_read").map((activity, index) => (
              <div key={activity.id} className="animate-fade-in-up" style={{ animationDelay: `${(index + 3) * 50}ms` }}>
                <ActivityCard activity={activity} variant="profile" />
              </div>
            ))}
          </div>
        ) : (
          <article className="panel empty-state-pulse animate-fade-in-up animate-delay-300">
            <p className="text-sm leading-7 text-muted">There is no public activity to show here yet.</p>
          </article>
        )
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
                        <div key={entry.id}>
                          <div className="library-grid library-row">
                            <div className="library-title-cell">
                              <div className="library-cover-cell">
                                <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-[8px] border border-line/80 bg-surface-strong">
                                  {entry.imageUrl ? (
                                    <Image alt={entry.title ?? `${activeView} entry`} className="library-cover-image object-cover" fill sizes="36px" src={entry.imageUrl} />
                                  ) : null}
                                  <span aria-hidden="true" className="library-cover-overlay">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="1" />
                                      <circle cx="19" cy="12" r="1" />
                                      <circle cx="5" cy="12" r="1" />
                                    </svg>
                                  </span>
                                  <a aria-label={`Edit ${entry.title ?? `MAL ${entry.malId}`}`} className="library-cover-button" href={`#${modalId}`} />
                                </div>
                              </div>
                              <Link className="truncate text-sm text-foreground transition-colors hover:text-primary" href={`/${activeView}/${entry.malId}`}>
                                {entry.title ?? `MAL ${entry.malId}`}
                              </Link>
                            </div>

                            <div className="library-meta-cell">{entry.score ?? "-"}</div>
                            <div className="library-meta-cell">{formatProgress(entry)}</div>
                            <div className="library-meta-cell">{entry.type ?? "-"}</div>
                          </div>

                          <div aria-modal="true" className="tracking-modal-layer" id={modalId} role="dialog">
                            <a aria-label="Close modal" className="tracking-modal-backdrop" href="#" />
                            <div className="tracking-modal panel">
                              <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                  <p className="eyebrow">Your tracking</p>
                                  <h3 className="font-display text-2xl text-foreground">Edit entry</h3>
                                  <p className="mt-1 line-clamp-1 text-sm text-muted">{entry.title ?? `MAL ${entry.malId}`}</p>
                                </div>
                                <a aria-label="Close modal" className="modal-icon-button" href="#">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                  </svg>
                                </a>
                              </div>

                              {activeView === "anime" ? (
                                <>
                                  <ModalForm action={saveAnimeEntryAction} className="grid gap-3 md:grid-cols-2">
                                    <input name="malId" type="hidden" value={String(entry.malId)} />
                                    <label className="field">
                                      <span>Status</span>
                                      <select className="input" defaultValue={entry.status} name="status">
                                        <option value="watching">Watching</option>
                                        <option value="completed">Completed</option>
                                        <option value="rewatching">Rewatching</option>
                                        <option value="dropped">Dropped</option>
                                        <option value="plan_to_watch">Plan to watch</option>
                                      </select>
                                    </label>
                                    <label className="field">
                                      <span>Score</span>
                                      <input className="input" defaultValue={entry.score ?? ""} max={10} min={1} name="score" type="number" />
                                    </label>
                                    <label className="field">
                                      <span>Episodes watched</span>
                                      <input className="input" defaultValue={entry.progress} min={0} name="progressEpisodes" type="number" />
                                    </label>
                                    <div className="flex items-end">
                                      <button className="button button-primary w-full" type="submit">
                                        Save entry
                                      </button>
                                    </div>
                                  </ModalForm>
                                  <ModalForm action={deleteLibraryEntryAction} className="modal-danger-action">
                                    <input name="mediaType" type="hidden" value="anime" />
                                    <input name="malId" type="hidden" value={String(entry.malId)} />
                                    <button aria-label="Delete entry" className="modal-icon-button modal-icon-button-danger" type="submit">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 7h16" />
                                        <path d="M10 11v6" />
                                        <path d="M14 11v6" />
                                        <path d="M6 7l1 11a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-11" />
                                        <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                      </svg>
                                    </button>
                                  </ModalForm>
                                </>
                              ) : (
                                <>
                                  <ModalForm action={saveMangaEntryAction} className="grid gap-3 md:grid-cols-2">
                                    <input name="malId" type="hidden" value={String(entry.malId)} />
                                    <label className="field">
                                      <span>Status</span>
                                      <select className="input" defaultValue={entry.status} name="status">
                                        <option value="reading">Reading</option>
                                        <option value="completed">Completed</option>
                                        <option value="rereading">Rereading</option>
                                        <option value="dropped">Dropped</option>
                                        <option value="plan_to_read">Plan to read</option>
                                      </select>
                                    </label>
                                    <label className="field">
                                      <span>Score</span>
                                      <input className="input" defaultValue={entry.score ?? ""} max={10} min={1} name="score" type="number" />
                                    </label>
                                    <label className="field">
                                      <span>Chapters read</span>
                                      <input className="input" defaultValue={entry.progress} min={0} name="progressChapters" type="number" />
                                    </label>
                                    <label className="field">
                                      <span>Volumes read</span>
                                      <input className="input" defaultValue={entry.progressVolumes ?? 0} min={0} name="progressVolumes" type="number" />
                                    </label>
                                    <div className="md:col-span-2">
                                      <button className="button button-primary w-full md:w-auto" type="submit">
                                        Save entry
                                      </button>
                                    </div>
                                  </ModalForm>
                                  <ModalForm action={deleteLibraryEntryAction} className="modal-danger-action">
                                    <input name="mediaType" type="hidden" value="manga" />
                                    <input name="malId" type="hidden" value={String(entry.malId)} />
                                    <button aria-label="Delete entry" className="modal-icon-button modal-icon-button-danger" type="submit">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 7h16" />
                                        <path d="M10 11v6" />
                                        <path d="M14 11v6" />
                                        <path d="M6 7l1 11a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-11" />
                                        <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                      </svg>
                                    </button>
                                  </ModalForm>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              </section>
            );
          })}
        </div>
      ) : (
        <article className="panel empty-state-pulse animate-fade-in-up animate-delay-300">
          <p className="text-sm leading-7 text-muted">No {activeView} entries match the current filter.</p>
        </article>
      )}
    </section>
  );
}
