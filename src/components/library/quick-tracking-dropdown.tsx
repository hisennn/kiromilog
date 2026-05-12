"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/app/toaster";

import { saveAnimeEntryAction, saveMangaEntryAction } from "@/lib/library-actions";
import { animeStatusOptions, mangaStatusOptions } from "@/lib/library-status";

type QuickTrackingDropdownProps = {
  mediaType: "anime" | "manga";
  malId: number;
  hasEntry: boolean;
  currentStatus: string | null;
  modalId: string;
  className?: string;
  onOpenChange?: (isOpen: boolean) => void;
};

export function QuickTrackingDropdown({
  mediaType,
  malId,
  hasEntry,
  currentStatus,
  modalId,
  className,
  onOpenChange,
}: QuickTrackingDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(currentStatus);
  const [optimisticHasEntry, setOptimisticHasEntry] = useState(hasEntry);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const options = mediaType === "anime" ? animeStatusOptions : mangaStatusOptions;
  const quickOptionValues =
    mediaType === "anime"
      ? new Set(["watching", "completed", "plan_to_watch"])
      : new Set(["reading", "completed", "plan_to_read"]);
  const quickOptions = options.filter((option) => quickOptionValues.has(option.value));
  const action = mediaType === "anime" ? saveAnimeEntryAction : saveMangaEntryAction;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    return () => onOpenChange?.(false);
  }, [onOpenChange]);

  const handleStatusSelect = (status: string) => {
    setIsOpen(false);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("malId", String(malId));
      formData.append("status", status);

      const result = await action(formData);

      if (result === false) {
        return;
      }

      setOptimisticStatus(status);
      setOptimisticHasEntry(true);

      const label = options.find((option) => option.value === status)?.label || status;
      toast(`Adicionado em ${label}`);
      router.refresh();
    });
  };

  const getStatusLabel = () => {
    if (!optimisticHasEntry || !optimisticStatus) {
      return "Add";
    }

    return options.find((option) => option.value === optimisticStatus)?.label || "Add";
  };

  const labelClassName = "block truncate text-sm leading-[1.2] font-medium";

  const primaryActionContent = isPending ? (
    <span className="inline-flex items-center justify-center h-4 w-4" aria-label="Saving...">
      <span className="loading-spinner text-current" />
    </span>
  ) : (
    <span className={labelClassName}>{getStatusLabel()}</span>
  );

  const primaryActionClass =
    "flex h-9 flex-1 min-w-0 cursor-pointer items-center justify-center px-3 whitespace-nowrap font-sans text-sm leading-[1.2] font-medium text-foreground transition-colors hover:bg-white/5";
  const widthClass = className || "w-[172px]";

  return (
    <div className={`relative inline-flex rounded-[2px] border border-line/80 bg-surface-strong shadow-sm ${isOpen ? "z-50" : "z-10"} ${widthClass}`} ref={containerRef}>
      {!optimisticHasEntry ? (
        <button
          type="button"
          onClick={() => handleStatusSelect(mediaType === "anime" ? "plan_to_watch" : "plan_to_read")}
          className={primaryActionClass}
          disabled={isPending}
        >
          {primaryActionContent}
        </button>
      ) : (
        <a href={`#${modalId}`} className={primaryActionClass}>
          {primaryActionContent}
        </a>
      )}

      <div className="w-[1px] bg-line/80" />

        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
        className="flex h-9 shrink-0 items-center justify-center px-2.5 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
        aria-label="Mais opcoes"
        disabled={isPending}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-[200] mt-1.5 w-48 rounded-[2px] border border-white/10 bg-[#1c1c1c] p-1.5 shadow-xl animate-fade-in-up">
          <div className="flex flex-col gap-0.5">
            {quickOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleStatusSelect(option.value)}
                className={`flex min-h-9 w-full cursor-pointer items-center rounded-sm px-3 py-1.5 text-left font-sans text-sm leading-[1.2] font-medium transition-colors hover:bg-white/10 hover:text-white ${
                  optimisticStatus === option.value ? "bg-white/10 text-white" : "text-foreground"
                }`}
                disabled={isPending}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="my-1.5 h-[1px] w-full bg-white/10" />

          <a
            href={`#${modalId}`}
            onClick={() => setIsOpen(false)}
            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm px-3 py-2 text-left font-sans text-sm font-medium text-muted/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Editar
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              <path d="m15 5 4 4"/>
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

