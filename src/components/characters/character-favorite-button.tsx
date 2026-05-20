"use client";

import { Star } from "iconoir-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@/components/app/toaster";
import { toggleFavoriteCharacterAction } from "@/lib/character-actions";

type CharacterFavoriteButtonProps = {
  malId: number;
  initialIsFavorite: boolean;
};

export function CharacterFavoriteButton({
  malId,
  initialIsFavorite,
}: CharacterFavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggle() {
    if (isPending) {
      return;
    }

    const formData = new FormData();
    formData.set("malId", String(malId));

    startTransition(async () => {
      const result = await toggleFavoriteCharacterAction(formData);

      if (!result.ok) {
        if (result.reason === "limit") {
          toast("You can favorite up to 9 characters.", "danger");
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
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      disabled={isPending}
      className={`button flex h-11 items-center justify-center gap-2 px-4 transition-colors ${
        isFavorite
          ? "border-[#f3c96a]/50 bg-[#f3c96a]/12 text-[#f3c96a]"
          : "button-primary"
      } ${isPending ? "cursor-wait" : "cursor-pointer"}`}
    >
      <Star width={18} height={18} fill={isFavorite ? "currentColor" : "none"} strokeWidth={2} />
      <span>{isFavorite ? "Favorited" : "Favorite"}</span>
    </button>
  );
}
