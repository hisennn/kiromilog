"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@/components/app/toaster";
import { updateBioAction } from "@/lib/settings-actions";

type BioSettingsPanelProps = {
  initialBio: string | null;
};

export function BioSettingsPanel({ initialBio }: BioSettingsPanelProps) {
  const router = useRouter();
  const [bio, setBio] = useState(initialBio ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const formData = new FormData();
    formData.set("bio", bio);

    startTransition(async () => {
      const result = await updateBioAction(formData);

      if (!result.ok) {
        toast(result.message, "danger");
        return;
      }

      toast("Bio updated.");
      router.refresh();
    });
  }

  return (
    <section className="panel animate-fade-in-up animate-delay-300 space-y-4">
      <div>
        <p className="eyebrow tracking-widest text-[10px] text-muted">Profile</p>
        <h2 className="mt-1 font-display text-2xl text-foreground">Bio</h2>
      </div>

      <div className="field">
        <span>Short description (up to 280 characters)</span>
        <textarea
          className="input min-h-24 resize-y"
          maxLength={280}
          name="bio"
          onChange={(event) => setBio(event.target.value)}
          placeholder="Tell people about yourself..."
          rows={3}
          value={bio}
        />
      </div>

      <div>
        <button
          type="button"
          className="button button-primary"
          disabled={isPending}
          onClick={handleSave}
          aria-busy={isPending}
        >
          {isPending ? "Saving..." : "Save bio"}
        </button>
      </div>
    </section>
  );
}
