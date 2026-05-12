"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { animeStatusOptions, mangaStatusOptions } from "@/lib/library-status";
import { toggleFavoriteAnimeAction } from "@/lib/library-actions";
import { toast } from "@/components/app/toaster";

type TrackingAction = (formData: FormData) => Promise<boolean | void>;

type StatusOption = {
  value: string;
  label: string;
};

function StatusDropdown({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (val: string) => void;
  options: StatusOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerClassName =
    "input flex h-11 w-full items-center justify-between gap-3 px-3 text-left leading-[1.2]";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find((opt) => opt.value === value)?.label || value;

  return (
    <div className="relative w-full" ref={containerRef}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={triggerClassName}
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-[2px] border border-white/10 bg-[#1c1c1c] p-1 shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full rounded-[2px] px-3 py-2 text-left text-sm transition-colors hover:bg-white/10 hover:text-white ${
                value === opt.value ? "bg-white/5 text-white" : "text-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type AnimeTrackingModalProps = {
  malId: number;
  title: string;
  imageUrl?: string | null;
  titleJapanese?: string | null;
  action: TrackingAction;
  hasEntry: boolean;
  defaultStatus: string;
  defaultScore: number | string;
  defaultProgress: number;
  maxEpisodes: number | null;
  initialIsFavorite: boolean;
};

type MangaTrackingModalProps = {
  malId: number;
  title: string;
  imageUrl?: string | null;
  titleJapanese?: string | null;
  action: TrackingAction;
  hasEntry: boolean;
  defaultStatus: string;
  defaultScore: number | string;
  defaultChapters: number;
  defaultVolumes: number;
  maxChapters: number | null;
  maxVolumes: number | null;
};

type TrackingModalFrameProps = {
  modalId: string;
  title: string;
  imageUrl?: string | null;
  titleJapanese?: string | null;
  children: React.ReactNode;
};

function normalizeScore(val: number | string): number | "" {
  return val === "" ? "" : Number(val);
}

function normalizeScoreInput(value: string): number | "" {
  if (value === "") {
    return "";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  return Math.min(Math.max(Math.trunc(numericValue), 1), 10);
}

function clampProgressValue(value: number, max: number | null): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = Math.max(0, Math.trunc(value));
  return max === null ? normalized : Math.min(normalized, max);
}

function progressValueToInput(value: number, status: string, max: number | null): string {
  if (status === "completed" && max === null && value === 0) {
    return "";
  }

  return String(clampProgressValue(value, max));
}

function sanitizeProgressInput(rawValue: string, max: number | null): string {
  if (rawValue === "") {
    return "";
  }

  const numericValue = Number(rawValue);

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  return String(clampProgressValue(numericValue, max));
}

export function TrackingModalFrame({
  modalId,
  title,
  imageUrl,
  titleJapanese,
  children,
}: TrackingModalFrameProps) {
  return (
    <div aria-modal="true" className="tracking-modal-layer" id={modalId} role="dialog">
      <a aria-label="Fechar modal" className="tracking-modal-backdrop" href="#" />
      <div className="tracking-modal panel">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {imageUrl ? (
              <div className="relative h-20 w-14 shrink-0 overflow-hidden border border-line bg-surface-strong">
                <Image alt="" className="object-cover" fill sizes="56px" src={imageUrl} />
              </div>
            ) : null}
            <div>
              <p className="eyebrow tracking-widest text-[10px] text-muted">Your list</p>
              <h2 className="mt-1 font-display text-lg text-foreground/90 line-clamp-1">{title}</h2>
              {titleJapanese ? (
                <p className="mt-0.5 text-xs text-muted/40 line-clamp-1">{titleJapanese}</p>
              ) : null}
            </div>
          </div>
          <a aria-label="Fechar modal" className="modal-icon-button shrink-0" href="#">
            <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </a>
        </div>

        {children}
      </div>
    </div>
  );
}

function AnimeTrackingFormInner({
  malId,
  action,
  hasEntry,
  defaultStatus,
  defaultScore,
  defaultProgress,
  maxEpisodes,
  initialIsFavorite,
}: Omit<AnimeTrackingModalProps, "title">) {
  const [status, setStatus] = useState(defaultStatus);
  const [score, setScore] = useState<number | "">(normalizeScore(defaultScore));
  const [progressInput, setProgressInput] = useState(() =>
    progressValueToInput(defaultProgress, defaultStatus, maxEpisodes),
  );
  const [savedStatus, setSavedStatus] = useState(defaultStatus);
  const [savedScore, setSavedScore] = useState<number | "">(normalizeScore(defaultScore));
  const [savedProgressInput, setSavedProgressInput] = useState(() =>
    progressValueToInput(defaultProgress, defaultStatus, maxEpisodes),
  );
  const [hasSavedEntry, setHasSavedEntry] = useState(hasEntry);
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success">("idle");
  const [isPending, startTransition] = useTransition();
  const [isFavoritePending, startFavoriteTransition] = useTransition();
  const router = useRouter();

  const isDirty =
    status !== savedStatus ||
    score !== savedScore ||
    progressInput !== savedProgressInput;
  const canSubmit = !hasSavedEntry || isDirty;

  const handleStatusChange = (nextStatus: string) => {
    setStatus(nextStatus);

    if (nextStatus === "completed") {
      setProgressInput(maxEpisodes === null ? "" : String(maxEpisodes));
    }
  };

  const handleProgressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextProgress = sanitizeProgressInput(event.target.value, maxEpisodes);
    setProgressInput(nextProgress);

    if (status === "plan_to_watch" && Number(nextProgress || 0) > 0) {
      setStatus("watching");
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit || isPending) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const normalizedProgress = sanitizeProgressInput(progressInput, maxEpisodes);

    if (normalizedProgress === "") {
      formData.delete("progressEpisodes");
    } else {
      formData.set("progressEpisodes", normalizedProgress);
    }

    startTransition(async () => {
      const result = await action(formData);

      if (result === false) {
        return;
      }

      setHasSavedEntry(true);
      setSavedStatus(status);
      setSavedScore(score);
      setSavedProgressInput(progressValueToInput(Number(normalizedProgress || 0), status, maxEpisodes));
      setSaveStatus("success");
      toast("Entry saved.");
      router.refresh();
      setTimeout(() => setSaveStatus("idle"), 3000);
    });
  };

  const handleFavoriteToggle = () => {
    if (isFavoritePending) {
      return;
    }

    const formData = new FormData();
    formData.set("malId", String(malId));

    startFavoriteTransition(async () => {
      const result = await toggleFavoriteAnimeAction(formData);

      if (!result.ok) {
        if (result.reason === "limit") {
          toast("You can favorite up to 12 anime.", "danger");
        }

        return;
      }

      setIsFavorite(result.favorited);
      toast(
        result.favorited ? "Added to favorites" : "Removed from favorites",
        result.favorited ? "success" : "danger",
      );
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-3">
      <input name="malId" type="hidden" value={String(malId)} />

      <label className="field relative">
        <span>Status</span>
        <StatusDropdown
          name="status"
          value={status}
          onChange={handleStatusChange}
          options={animeStatusOptions}
        />
      </label>

      <label className="field">
        <span>Episodes watched</span>
        <input
          className="input h-11"
          max={maxEpisodes ?? undefined}
          min={0}
          name="progressEpisodes"
          type="number"
          value={progressInput}
          onChange={handleProgressChange}
        />
      </label>

      <label className="field">
        <span>Score</span>
        <input
          className="input h-11"
          max={10}
          min={1}
          name="score"
          type="number"
          value={score}
          onChange={(event) => setScore(normalizeScoreInput(event.target.value))}
        />
      </label>

      <div className="mt-2 flex flex-col items-start justify-between gap-3 text-xs text-muted md:col-span-3 md:flex-row md:items-center">
        <span>{maxEpisodes ? `Max episodes: ${maxEpisodes}` : "Total not confirmed."}</span>
        <div className="flex w-full items-center justify-end gap-3 md:w-auto">
          <button
            type="button"
            onClick={handleFavoriteToggle}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            disabled={isFavoritePending}
            className={`button flex h-11 w-11 shrink-0 items-center justify-center border px-0 transition-colors ${
              isFavorite
                ? "border-[#f3c96a]/50 bg-[#f3c96a]/12 text-[#f3c96a]"
                : "border-[#2b2b2b] bg-[#1c1c1c] text-muted hover:text-[#f3c96a]"
            } ${isFavoritePending ? "cursor-wait" : "cursor-pointer"}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
          <button
            type="submit"
            disabled={!canSubmit || isPending || saveStatus === "success"}
            className={`button flex h-11 w-full items-center justify-center overflow-hidden px-4 text-sm leading-[1.2] transition-all duration-300 ${
              saveStatus === "success"
                ? "gap-2 border-transparent bg-[#238636] text-white md:w-[112px]"
                : !canSubmit || isPending
                  ? "cursor-not-allowed border border-[#2b2b2b] bg-[#1c1c1c] !opacity-100 text-[#a0a0a0] md:w-[104px]"
                  : "button-primary cursor-pointer md:w-[104px]"
            }`}
          >
            {saveStatus === "success" ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-sm font-medium">Saved</span>
              </>
            ) : isPending ? (
              <span className="inline-flex h-4 w-4 items-center justify-center" aria-label="Saving...">
                <span className="loading-spinner text-current" />
              </span>
            ) : hasSavedEntry ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function AnimeTrackingForm(props: Omit<AnimeTrackingModalProps, "title">) {
  const resetKey = [
    props.malId,
    props.hasEntry ? "existing" : "new",
    props.defaultStatus,
    String(props.defaultScore),
    props.defaultProgress,
    props.maxEpisodes ?? "none",
    props.initialIsFavorite ? "favorite" : "not-favorite",
  ].join(":");

  return <AnimeTrackingFormInner key={resetKey} {...props} />;
}

function MangaTrackingFormInner({
  malId,
  action,
  hasEntry,
  defaultStatus,
  defaultScore,
  defaultChapters,
  defaultVolumes,
  maxChapters,
  maxVolumes,
}: Omit<MangaTrackingModalProps, "title">) {
  const [status, setStatus] = useState(defaultStatus);
  const [score, setScore] = useState<number | "">(normalizeScore(defaultScore));
  const [chaptersInput, setChaptersInput] = useState(() =>
    progressValueToInput(defaultChapters, defaultStatus, maxChapters),
  );
  const [volumesInput, setVolumesInput] = useState(() =>
    progressValueToInput(defaultVolumes, defaultStatus, maxVolumes),
  );
  const [savedStatus, setSavedStatus] = useState(defaultStatus);
  const [savedScore, setSavedScore] = useState<number | "">(normalizeScore(defaultScore));
  const [savedChaptersInput, setSavedChaptersInput] = useState(() =>
    progressValueToInput(defaultChapters, defaultStatus, maxChapters),
  );
  const [savedVolumesInput, setSavedVolumesInput] = useState(() =>
    progressValueToInput(defaultVolumes, defaultStatus, maxVolumes),
  );
  const [hasSavedEntry, setHasSavedEntry] = useState(hasEntry);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success">("idle");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isDirty =
    status !== savedStatus ||
    score !== savedScore ||
    chaptersInput !== savedChaptersInput ||
    volumesInput !== savedVolumesInput;
  const canSubmit = !hasSavedEntry || isDirty;

  const handleStatusChange = (nextStatus: string) => {
    setStatus(nextStatus);

    if (nextStatus === "completed") {
      setChaptersInput(maxChapters === null ? "" : String(maxChapters));
      setVolumesInput(maxVolumes === null ? "" : String(maxVolumes));
    }
  };

  const handleChaptersChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextChapters = sanitizeProgressInput(event.target.value, maxChapters);
    setChaptersInput(nextChapters);

    if (status === "plan_to_read" && Number(nextChapters || 0) > 0) {
      setStatus("reading");
    }
  };

  const handleVolumesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextVolumes = sanitizeProgressInput(event.target.value, maxVolumes);
    setVolumesInput(nextVolumes);

    if (status === "plan_to_read" && Number(nextVolumes || 0) > 0) {
      setStatus("reading");
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit || isPending) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const normalizedChapters = sanitizeProgressInput(chaptersInput, maxChapters);
    const normalizedVolumes = sanitizeProgressInput(volumesInput, maxVolumes);

    if (normalizedChapters === "") {
      formData.delete("progressChapters");
    } else {
      formData.set("progressChapters", normalizedChapters);
    }

    if (normalizedVolumes === "") {
      formData.delete("progressVolumes");
    } else {
      formData.set("progressVolumes", normalizedVolumes);
    }

    startTransition(async () => {
      const result = await action(formData);

      if (result === false) {
        return;
      }

      setHasSavedEntry(true);
      setSavedStatus(status);
      setSavedScore(score);
      setSavedChaptersInput(progressValueToInput(Number(normalizedChapters || 0), status, maxChapters));
      setSavedVolumesInput(progressValueToInput(Number(normalizedVolumes || 0), status, maxVolumes));
      setSaveStatus("success");
      toast("Entry saved.");
      router.refresh();
      setTimeout(() => setSaveStatus("idle"), 3000);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <input name="malId" type="hidden" value={String(malId)} />

      <label className="field relative z-10">
        <span>Status</span>
        <StatusDropdown
          name="status"
          value={status}
          onChange={handleStatusChange}
          options={mangaStatusOptions}
        />
      </label>

      <label className="field">
        <span>Chapters read</span>
        <input
          className="input h-11"
          max={maxChapters ?? undefined}
          min={0}
          name="progressChapters"
          type="number"
          value={chaptersInput}
          onChange={handleChaptersChange}
        />
      </label>

      <label className="field">
        <span>Volumes read</span>
        <input
          className="input h-11"
          max={maxVolumes ?? undefined}
          min={0}
          name="progressVolumes"
          type="number"
          value={volumesInput}
          onChange={handleVolumesChange}
        />
      </label>

      <label className="field">
        <span>Score</span>
        <input
          className="input h-11"
          max={10}
          min={1}
          name="score"
          type="number"
          value={score}
          onChange={(event) => setScore(normalizeScoreInput(event.target.value))}
        />
      </label>

      <div className="mt-2 flex flex-col items-start justify-between gap-3 text-xs text-muted md:col-span-2 md:flex-row md:items-center xl:col-span-4">
        <span>{maxChapters ? `Max chapters: ${maxChapters}` : "Chapter total not confirmed."}</span>
        <div className="flex w-full items-center justify-end gap-3 md:w-auto">
          <button
            type="submit"
            disabled={!canSubmit || isPending || saveStatus === "success"}
            className={`button flex h-11 w-full items-center justify-center overflow-hidden px-4 text-sm leading-[1.2] transition-all duration-300 ${
              saveStatus === "success"
                ? "gap-2 border-transparent bg-[#238636] text-white md:w-[112px]"
                : !canSubmit || isPending
                  ? "cursor-not-allowed border border-[#2b2b2b] bg-[#1c1c1c] !opacity-100 text-[#a0a0a0] md:w-[104px]"
                  : "button-primary cursor-pointer md:w-[104px]"
            }`}
          >
            {saveStatus === "success" ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-sm font-medium">Saved</span>
              </>
            ) : isPending ? (
              <span className="inline-flex h-4 w-4 items-center justify-center" aria-label="Saving...">
                <span className="loading-spinner text-current" />
              </span>
            ) : hasSavedEntry ? "Update" : "Add"}
          </button>
        </div>
      </div>

      {saveStatus === "success" && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-3 bg-[#131b14] border border-[#238636]/40 px-5 py-3 rounded shadow-2xl animate-fade-in-up text-[14px] font-medium text-foreground">
          <svg className="text-primary" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          Entry saved.
        </div>
      )}
    </form>
  );
}

export function MangaTrackingForm(props: Omit<MangaTrackingModalProps, "title">) {
  const resetKey = [
    props.malId,
    props.hasEntry ? "existing" : "new",
    props.defaultStatus,
    String(props.defaultScore),
    props.defaultChapters,
    props.defaultVolumes,
    props.maxChapters ?? "none",
    props.maxVolumes ?? "none",
  ].join(":");

  return <MangaTrackingFormInner key={resetKey} {...props} />;
}

export function AnimeTrackingModal({ malId, title, imageUrl, titleJapanese, action, hasEntry, defaultStatus, defaultScore, defaultProgress, maxEpisodes, initialIsFavorite }: AnimeTrackingModalProps) {
  return (
    <TrackingModalFrame
      modalId="tracking-modal"
      title={title}
      imageUrl={imageUrl}
      titleJapanese={titleJapanese}
    >
        <AnimeTrackingForm
          action={action}
          defaultProgress={defaultProgress}
          defaultScore={defaultScore}
          defaultStatus={defaultStatus}
          hasEntry={hasEntry}
          initialIsFavorite={initialIsFavorite}
          malId={malId}
          maxEpisodes={maxEpisodes}
        />
    </TrackingModalFrame>
  );
}

export function MangaTrackingModal({ malId, title, imageUrl, titleJapanese, action, hasEntry, defaultStatus, defaultScore, defaultChapters, defaultVolumes, maxChapters, maxVolumes }: MangaTrackingModalProps) {
  return (
    <TrackingModalFrame
      modalId="tracking-modal"
      title={title}
      imageUrl={imageUrl}
      titleJapanese={titleJapanese}
    >
        <MangaTrackingForm
          action={action}
          defaultChapters={defaultChapters}
          defaultScore={defaultScore}
          defaultStatus={defaultStatus}
          defaultVolumes={defaultVolumes}
          hasEntry={hasEntry}
          malId={malId}
          maxChapters={maxChapters}
          maxVolumes={maxVolumes}
        />
    </TrackingModalFrame>
  );
}

