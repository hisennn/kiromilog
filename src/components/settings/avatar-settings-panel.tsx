"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@/components/app/toaster";
import { removeAvatarAction, uploadAvatarAction } from "@/lib/settings-actions";
import { AVATAR_MAX_UPLOAD_MB } from "@/lib/settings";

type AvatarSettingsPanelProps = {
  avatarUrl: string | null;
  username: string;
};

export function AvatarSettingsPanel({
  avatarUrl,
  username,
}: AvatarSettingsPanelProps) {
  const inputId = useId();
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploadPending, startUploadTransition] = useTransition();
  const [isRemovePending, startRemoveTransition] = useTransition();
  const previewUrlRef = useRef<string | null>(null);
  const isBlobPreview = previewUrl?.startsWith("blob:") ?? false;

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const handleFileChange = (file: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setSelectedFile(file);

    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast("Choose an image before uploading.", "danger");
      return;
    }

    const formData = new FormData();
    formData.set("avatar", selectedFile);

    startUploadTransition(async () => {
      const result = await uploadAvatarAction(formData);

      if (!result.ok) {
        toast(result.message, "danger");
        return;
      }

      handleFileChange(null);
      toast("Avatar updated successfully.");
      router.refresh();
    });
  };

  const handleRemove = () => {
    startRemoveTransition(async () => {
      const result = await removeAvatarAction();

      if (!result.ok) {
        toast("Could not remove the avatar right now.", "danger");
        return;
      }

      handleFileChange(null);
      toast("Avatar removed.");
      router.refresh();
    });
  };

  const isBusy = isUploadPending || isRemovePending;
  const currentPreviewUrl = previewUrl ?? avatarUrl;

  return (
    <section className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="panel animate-fade-in-up animate-delay-200 space-y-4" id="photo">
        <div>
          <p className="eyebrow tracking-widest text-[10px] text-muted">Preview</p>
          <h2 className="mt-1 font-display text-2xl text-foreground">Profile photo</h2>
        </div>

        {currentPreviewUrl ? (
          <div className="relative aspect-square w-full overflow-hidden border border-line bg-surface-strong">
            <Image
              alt={`@${username}`}
              className="object-cover"
              fill
              sizes="288px"
              src={currentPreviewUrl}
              unoptimized={isBlobPreview}
            />
          </div>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center border border-line bg-surface-strong font-display text-6xl text-foreground/90">
            {username.slice(0, 1).toUpperCase()}
          </div>
        )}

        <p className="text-sm leading-7 text-muted">
          Accepted formats: JPG, PNG, WEBP. Max size: {AVATAR_MAX_UPLOAD_MB} MB.
        </p>
      </div>

      <div className="space-y-6">
        <section className="panel animate-fade-in-up animate-delay-300 space-y-4">
          <div>
            <p className="eyebrow tracking-widest text-[10px] text-muted">Upload</p>
            <h2 className="mt-1 font-display text-2xl text-foreground">Avatar settings</h2>
          </div>

          <div className="h-px w-full bg-line/70" />

          <div className="field">
            <span>Choose image</span>
            <input
              id={inputId}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              type="file"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />
            <label
              htmlFor={inputId}
              className="input flex h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm text-muted transition-colors hover:border-line/80 hover:text-foreground"
            >
              <span className="truncate">
                {selectedFile ? selectedFile.name : "Select a new avatar"}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-muted/80">Browse</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="button button-primary"
              disabled={isBusy || !selectedFile}
              onClick={handleUpload}
            >
              Upload photo
            </button>
            <button
              type="button"
              className="button button-ghost"
              disabled={isBusy || (!avatarUrl && !selectedFile)}
              onClick={handleRemove}
            >
              Remove photo
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
