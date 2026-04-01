"use client";

import Image from "next/image";
import Link from "next/link";

import { ModalForm } from "@/components/shared/modal-form";

import {
  saveAnimeEntryAction,
  saveMangaEntryAction,
} from "@/lib/library-actions";

type SearchResultCardProps = {
  item: {
    malId: number;
    mediaType: "anime" | "manga";
    title: string;
    imageUrl: string | null;
    score: number | null;
    progressTotal: number | null;
    libraryEntry:
      | {
          status: string;
          score: number | null;
          progressEpisodes?: number;
          progressChapters?: number;
          progressVolumes?: number;
        }
      | null;
  };
};

export function SearchResultCard({ item }: SearchResultCardProps) {
  const isAnime = item.mediaType === "anime";
  const action = isAnime ? saveAnimeEntryAction : saveMangaEntryAction;
  const modalId = `tracking-${item.mediaType}-${item.malId}`;
  const hasExistingEntry = item.libraryEntry !== null;
  const submitLabel = hasExistingEntry ? "Update" : "Add";
  const modalTitle = hasExistingEntry ? "Edit entry" : "Add to list";

  return (
    <>
      <article className="search-result-card">
        <div className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-[8px] border border-line/80 bg-surface-strong">
          {item.imageUrl ? (
            <Image alt={item.title} className="object-cover" fill sizes="80px" src={item.imageUrl} />
          ) : null}
        </div>

        <div className="search-result-copy">
          <div className="space-y-2">
            <Link
              className="block font-display text-2xl leading-tight text-foreground transition-colors hover:text-primary"
              href={`/${item.mediaType}/${item.malId}`}
            >
              {item.title}
            </Link>
            <p className="search-score-row">
              <span aria-hidden="true" className="search-score-star">*</span>
              <span>{item.score ? item.score.toFixed(2) : "No score"}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 relative z-10">
            <a className="button button-ghost" href={`#${modalId}`}>
              Add to list
            </a>
          </div>
        </div>
      </article>

      <div aria-modal="true" className="tracking-modal-layer" id={modalId} role="dialog">
        <a aria-label="Close modal" className="tracking-modal-backdrop" href="#" />
        <div className="tracking-modal panel">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Your tracking</p>
              <h2 className="font-display text-2xl text-foreground">{modalTitle}</h2>
              <p className="mt-1 line-clamp-1 text-sm text-muted">{item.title}</p>
            </div>
            <a aria-label="Close modal" className="modal-icon-button" href="#">
              <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </a>
          </div>

          <ModalForm action={action} className="grid gap-3 md:grid-cols-2">
            <input name="malId" type="hidden" value={String(item.malId)} />
            <label className="field">
              <span>Status</span>
              {isAnime ? (
                <select className="input" defaultValue={item.libraryEntry?.status ?? "plan_to_watch"} name="status">
                  <option value="watching">Watching</option>
                  <option value="completed">Completed</option>
                  <option value="rewatching">Rewatching</option>
                  <option value="dropped">Dropped</option>
                  <option value="plan_to_watch">Plan to watch</option>
                </select>
              ) : (
                <select className="input" defaultValue={item.libraryEntry?.status ?? "plan_to_read"} name="status">
                  <option value="reading">Reading</option>
                  <option value="completed">Completed</option>
                  <option value="rereading">Rereading</option>
                  <option value="dropped">Dropped</option>
                  <option value="plan_to_read">Plan to read</option>
                </select>
              )}
            </label>

            <label className="field">
              <span>Score</span>
              <input className="input" defaultValue={item.libraryEntry?.score ?? ""} max={10} min={1} name="score" type="number" />
            </label>

            {isAnime ? (
              <label className="field">
                <span>Episodes watched</span>
                <input
                  className="input"
                  defaultValue={item.libraryEntry?.progressEpisodes ?? 0}
                  max={item.progressTotal ?? undefined}
                  min={0}
                  name="progressEpisodes"
                  type="number"
                />
              </label>
            ) : (
              <>
                <label className="field">
                  <span>Chapters read</span>
                  <input
                    className="input"
                    defaultValue={item.libraryEntry?.progressChapters ?? 0}
                    max={item.progressTotal ?? undefined}
                    min={0}
                    name="progressChapters"
                    type="number"
                  />
                </label>
                <label className="field">
                  <span>Volumes read</span>
                  <input
                    className="input"
                    defaultValue={item.libraryEntry?.progressVolumes ?? 0}
                    min={0}
                    name="progressVolumes"
                    type="number"
                  />
                </label>
              </>
            )}

            <div className="mt-2 flex flex-col items-start justify-between gap-3 text-xs text-muted md:col-span-2 md:flex-row md:items-center">
              <span>
                {item.progressTotal
                  ? `${isAnime ? "Max episodes" : "Max chapters"}: ${item.progressTotal}`
                  : "No confirmed total on Jikan."}
              </span>
              <button className="button button-primary w-full md:w-auto" type="submit">
                {submitLabel}
              </button>
            </div>
          </ModalForm>
        </div>
      </div>
    </>
  );
}
