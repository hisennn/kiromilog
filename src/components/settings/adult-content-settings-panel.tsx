"use client";

import type { CSSProperties } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@/components/app/toaster";
import { updateAdultContentPreferenceAction } from "@/lib/settings-actions";

const NAV_ACCENT_COLOR = "#b82644";

type AdultContentSettingsPanelProps = {
  enabled: boolean;
};

export function AdultContentSettingsPanel({
  enabled,
}: AdultContentSettingsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const nextValue = !enabled;

    startTransition(async () => {
      const result = await updateAdultContentPreferenceAction(nextValue);

      if (!result.ok) {
        toast("Could not update this preference right now.", "danger");
        return;
      }

      toast(nextValue ? "NSFW content enabled." : "NSFW content disabled.");
      router.refresh();
    });
  };

  return (
    <section className="panel animate-fade-in-up animate-delay-400 space-y-4">
      <div>
        <p className="eyebrow tracking-widest text-[10px] text-muted">Catalog</p>
        <h2 className="mt-1 font-display text-2xl text-foreground">NSFW content</h2>
      </div>

      <div className="h-px w-full bg-line/70" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Show NSFW content</p>
          <p className="text-xs leading-5 text-muted">
            When disabled, explicit anime and manga are hidden from search, pages, feed, and profiles.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Show NSFW content"
          className={`adult-content-toggle ${enabled ? "adult-content-toggle-active" : ""}`}
          disabled={isPending}
          onClick={handleToggle}
          style={
            enabled
              ? ({
                  "--adult-toggle-accent": NAV_ACCENT_COLOR,
                } as CSSProperties)
              : undefined
          }
        >
          <span className="adult-content-toggle-knob" />
        </button>
      </div>
    </section>
  );
}
