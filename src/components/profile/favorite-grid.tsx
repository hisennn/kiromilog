"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@/components/app/toaster";
import { saveFavoriteCharacterOrderAction } from "@/lib/character-actions";
import {
  saveFavoriteAnimeOrderAction,
  saveFavoriteMangaOrderAction,
} from "@/lib/library-actions";

export type FavoriteGridItem = {
  id: string;
  malId: number;
  title: string | null;
  imageUrl: string | null;
  href: string;
  isExplicitBlocked?: boolean;
};

type FavoriteGridKind = "anime" | "manga" | "characters";

type FavoriteGridProps = {
  title: string;
  items: FavoriteGridItem[];
  fallbackLabel: string;
  kind: FavoriteGridKind;
  canEdit: boolean;
};

const saveActions = {
  anime: saveFavoriteAnimeOrderAction,
  manga: saveFavoriteMangaOrderAction,
  characters: saveFavoriteCharacterOrderAction,
};

function moveItem(items: FavoriteGridItem[], fromId: string, toId: string) {
  const fromIndex = items.findIndex((item) => item.id === fromId);
  const toIndex = items.findIndex((item) => item.id === toId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);

  return nextItems;
}

export function FavoriteGrid({
  title,
  items,
  fallbackLabel,
  kind,
  canEdit,
}: FavoriteGridProps) {
  const [orderedItems, setOrderedItems] = useState(items);
  const [isEditing, setIsEditing] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!items.length) {
    return null;
  }

  function handleSave() {
    if (isPending) {
      return;
    }

    startTransition(async () => {
      const result = await saveActions[kind](orderedItems.map((item) => item.id));

      if (!result) {
        toast("Could not save order.", "danger");
        return;
      }

      setIsEditing(false);
      toast("Order saved.", "success");
      router.refresh();
    });
  }

  function handleActionClick() {
    if (isEditing) {
      handleSave();
      return;
    }

    setOrderedItems(items);
    setIsEditing(true);
  }

  return (
    <div className="group/favorites animate-fade-in-up animate-delay-200 pt-2">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg text-foreground">{title}</h2>
        {canEdit && orderedItems.length > 1 ? (
          <button
            type="button"
            onClick={handleActionClick}
            disabled={isPending}
            className={`border-0 bg-transparent p-0 font-sans text-[10px] font-medium normal-case tracking-normal transition ${
              isEditing || isPending
                ? "text-[#5fd38d] opacity-100 hover:text-[#86e7a8]"
                : "text-[#b82644] opacity-0 hover:text-[#e05268] group-hover/favorites:opacity-100 focus:opacity-100"
            } ${isPending ? "cursor-wait" : "cursor-pointer"}`}
          >
            {isPending ? "Saving" : isEditing ? "Save" : "Reorder"}
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {orderedItems.map((fav, index) => {
          const label = fav.title ?? `${fallbackLabel} ${fav.malId}`;
          const content = (
            <span className="absolute inset-0 overflow-hidden">
              {fav.imageUrl && (
                <Image
                  alt={fav.title ?? ""}
                  className={`object-cover ${
                    fav.isExplicitBlocked ? "scale-110 blur-sm opacity-50" : ""
                  }`}
                  fill
                  loading={index === 0 ? "eager" : "lazy"}
                  sizes="80px"
                  src={fav.imageUrl}
                />
              )}
              {fav.isExplicitBlocked ? (
                <span className="absolute inset-0 grid place-items-center bg-black/35 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                  +18
                </span>
              ) : null}
            </span>
          );

          if (isEditing) {
            return (
              <div
                key={fav.id}
                draggable={!isPending}
                onDragStart={(event) => {
                  setDraggedId(fav.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (draggedId) {
                    setOrderedItems((currentItems) => moveItem(currentItems, draggedId, fav.id));
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => setDraggedId(null)}
                onDragEnd={() => setDraggedId(null)}
                className={`fav-card relative aspect-[3/4] w-full cursor-grab bg-surface-strong ring-1 ring-line/70 transition ${
                  draggedId === fav.id ? "opacity-45" : "hover:ring-foreground/70"
                }`}
                aria-label={label}
                data-title={label}
              >
                {content}
              </div>
            );
          }

          return (
            <Link
              key={fav.id}
              href={fav.href}
              className="fav-card relative aspect-[3/4] w-full bg-surface-strong transition-opacity hover:opacity-80"
              aria-label={label}
              data-title={label}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
