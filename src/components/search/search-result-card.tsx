"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { QuickTrackingDropdown } from "@/components/library/quick-tracking-dropdown";
import {
  AnimeTrackingForm,
  MangaTrackingForm,
  TrackingModalFrame,
} from "@/components/library/tracking-modal";
import { saveAnimeEntryAction, saveMangaEntryAction } from "@/lib/library-actions";

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
    isFavorite?: boolean;
  };
};

export function SearchResultCard({ item }: SearchResultCardProps) {
  const [isQuickDropdownOpen, setIsQuickDropdownOpen] = useState(false);
  const isAnime = item.mediaType === "anime";
  const modalId = `tracking-${item.mediaType}-${item.malId}`;
  const hasExistingEntry = item.libraryEntry !== null;

  return (
    <>
      <article
        className={`relative search-result-card group ${
          isQuickDropdownOpen ? "z-[250]" : "focus-within:z-50 hover:z-50"
        }`}
      >
        <div className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden border border-line bg-surface-strong">
          {item.imageUrl ? (
            <Image alt={item.title} className="object-cover" fill sizes="80px" src={item.imageUrl} />
          ) : null}
        </div>

        <div className="search-result-copy relative group-focus-within:z-50">
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

          <div className="relative flex flex-wrap items-center gap-2 group-focus-within:z-50">
            <QuickTrackingDropdown
              key={`${item.mediaType}:${item.malId}:${item.libraryEntry?.status ?? "new"}:${hasExistingEntry ? "existing" : "new"}`}
              className="w-[172px]"
              mediaType={item.mediaType}
              malId={item.malId}
              hasEntry={hasExistingEntry}
              currentStatus={item.libraryEntry?.status ?? null}
              modalId={modalId}
              onOpenChange={setIsQuickDropdownOpen}
            />
          </div>
        </div>
      </article>

      <TrackingModalFrame modalId={modalId} title={item.title} imageUrl={item.imageUrl}>
          {isAnime ? (
            <AnimeTrackingForm
              action={saveAnimeEntryAction}
              malId={item.malId}
              hasEntry={hasExistingEntry}
              defaultStatus={item.libraryEntry?.status ?? "plan_to_watch"}
              defaultScore={item.libraryEntry?.score ?? ""}
              defaultProgress={item.libraryEntry?.progressEpisodes ?? 0}
              maxEpisodes={item.progressTotal}
              initialIsFavorite={item.isFavorite ?? false}
            />
          ) : (
            <MangaTrackingForm
              action={saveMangaEntryAction}
              malId={item.malId}
              hasEntry={hasExistingEntry}
              defaultStatus={item.libraryEntry?.status ?? "plan_to_read"}
              defaultScore={item.libraryEntry?.score ?? ""}
              defaultChapters={item.libraryEntry?.progressChapters ?? 0}
              defaultVolumes={item.libraryEntry?.progressVolumes ?? 0}
              maxChapters={item.progressTotal}
              maxVolumes={null}
            />
          )}
      </TrackingModalFrame>
    </>
  );
}
