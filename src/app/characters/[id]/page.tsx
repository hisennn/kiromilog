import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { CharacterFavoriteButton } from "@/components/characters/character-favorite-button";
import { getCharacterDetail, getViewerCharacterFavorite } from "@/lib/media-data";
import { ensureViewerProfile } from "@/lib/viewer-profile";

type CharacterPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type CharacterPayload = {
  name_kanji?: string | null;
  nicknames?: string[];
  about?: string | null;
  favorites?: number | null;
  anime?: Array<{ anime?: { mal_id: number; title: string; images?: { jpg?: { image_url?: string }; webp?: { image_url?: string } } } }>;
  manga?: Array<{ manga?: { mal_id: number; title: string; images?: { jpg?: { image_url?: string }; webp?: { image_url?: string } } } }>;
  voices?: Array<{
    language?: string | null;
    person?: {
      mal_id: number;
      name: string;
      images?: { jpg?: { image_url?: string }; webp?: { image_url?: string } };
    };
  }>;
};

function resolvePayloadImage(images?: { jpg?: { image_url?: string }; webp?: { image_url?: string } }) {
  return images?.webp?.image_url || images?.jpg?.image_url || null;
}

export default async function CharacterPage({ params }: CharacterPageProps) {
  const viewer = await ensureViewerProfile();

  if (!viewer) {
    redirect("/auth/sign-in");
  }

  const { id } = await params;
  const malId = Number(id);

  if (!Number.isInteger(malId) || malId <= 0) {
    notFound();
  }

  const [character, isFavorite] = await Promise.all([
    getCharacterDetail(malId),
    getViewerCharacterFavorite(viewer.id, malId),
  ]);
  const payload = character.payload as CharacterPayload;
  const animeAppearances = (payload.anime ?? [])
    .map((item) => item.anime)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 8);
  const mangaAppearances = (payload.manga ?? [])
    .map((item) => item.manga)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 8);
  const voices = (payload.voices ?? []).slice(0, 8);

  return (
    <main className="app-shell animate-fade-in-up">
      <AppHeader avatarUrl={viewer.avatarUrl} nickname={viewer.nickname} username={viewer.username} viewerId={viewer.id} />

      <section className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-4 animate-fade-in-up animate-delay-100">
          <div className="relative aspect-[3/4] overflow-hidden border border-line bg-surface-strong">
            {character.imageUrl ? (
              <Image alt={character.name} className="object-cover" fill loading="eager" sizes="288px" src={character.imageUrl} />
            ) : null}
          </div>

          <CharacterFavoriteButton malId={character.malId} initialIsFavorite={isFavorite} />

          <div className="panel space-y-3 text-sm">
            <div className="fact-row"><span>favorites</span><strong>{(payload.favorites ?? 0).toLocaleString("en-US")}</strong></div>
            <div className="fact-row"><span>anime</span><strong>{payload.anime?.length ?? 0}</strong></div>
            <div className="fact-row"><span>manga</span><strong>{payload.manga?.length ?? 0}</strong></div>
          </div>

          {payload.nicknames?.length ? (
            <div className="panel space-y-3">
              <p className="eyebrow tracking-widest text-[10px]">Nicknames</p>
              <div className="flex flex-wrap gap-2">
                {payload.nicknames.map((nickname) => (
                  <span className="tag" key={nickname}>{nickname}</span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-8">
          <section className="animate-fade-in-up animate-delay-200">
            <p className="eyebrow tracking-widest text-[10px] text-muted">Character</p>
            <h1 className="font-display text-5xl leading-none text-foreground tracking-tight mt-1">{character.name}</h1>
            {payload.name_kanji ? (
              <p className="text-lg text-muted/60 mt-3 font-medium">{payload.name_kanji}</p>
            ) : null}
          </section>

          <section className="animate-fade-in-up animate-delay-300">
            <p className="whitespace-pre-line text-base leading-relaxed text-muted/90 max-w-4xl">
              {payload.about || "No character description available."}
            </p>
          </section>

          {animeAppearances.length ? (
            <section className="space-y-4">
              <div>
                <p className="eyebrow tracking-widest text-[10px] text-muted">Anime</p>
                <h2 className="font-display text-3xl text-foreground mt-1">Appearances</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {animeAppearances.map((anime) => (
                  <Link className="character-card group" href={`/anime/${anime.mal_id}`} key={anime.mal_id}>
                    <span className="relative aspect-[3/4] overflow-hidden border border-line bg-surface-strong">
                      {resolvePayloadImage(anime.images) ? (
                        <Image alt={anime.title} className="object-cover transition-transform duration-500 group-hover:scale-105" fill sizes="160px" src={resolvePayloadImage(anime.images) as string} />
                      ) : null}
                    </span>
                    <span className="line-clamp-2 text-sm text-foreground">{anime.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {mangaAppearances.length ? (
            <section className="space-y-4">
              <div>
                <p className="eyebrow tracking-widest text-[10px] text-muted">Manga</p>
                <h2 className="font-display text-3xl text-foreground mt-1">Appearances</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {mangaAppearances.map((manga) => (
                  <Link className="character-card group" href={`/manga/${manga.mal_id}`} key={manga.mal_id}>
                    <span className="relative aspect-[3/4] overflow-hidden border border-line bg-surface-strong">
                      {resolvePayloadImage(manga.images) ? (
                        <Image alt={manga.title} className="object-cover transition-transform duration-500 group-hover:scale-105" fill sizes="160px" src={resolvePayloadImage(manga.images) as string} />
                      ) : null}
                    </span>
                    <span className="line-clamp-2 text-sm text-foreground">{manga.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {voices.length ? (
            <section className="space-y-4">
              <div>
                <p className="eyebrow tracking-widest text-[10px] text-muted">Voice actors</p>
                <h2 className="font-display text-3xl text-foreground mt-1">Cast</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {voices.map((voice) => (
                  <article className="panel flex items-center gap-3" key={`${voice.person?.mal_id}-${voice.language}`}>
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden border border-line bg-surface-strong">
                      {resolvePayloadImage(voice.person?.images) ? (
                        <Image alt={voice.person?.name ?? ""} className="object-cover" fill sizes="56px" src={resolvePayloadImage(voice.person?.images) as string} />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{voice.person?.name ?? "Unknown"}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">{voice.language ?? "Voice"}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
