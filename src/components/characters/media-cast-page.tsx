import Image from "next/image";
import Link from "next/link";

type MediaCastPageProps = {
  mediaTitle: string;
  mediaHref: string;
  mediaType: "anime" | "manga";
  characters: Array<{
    malId: number;
    name: string;
    imageUrl: string | null;
    role: string | null;
    favorites: number;
  }>;
};

export function MediaCastPage({
  mediaTitle,
  mediaHref,
  mediaType,
  characters,
}: MediaCastPageProps) {
  return (
    <section className="space-y-6">
      <div className="section-head">
        <div>
          <p className="eyebrow tracking-widest text-[10px] text-muted">{mediaType}</p>
          <h1 className="font-display text-4xl text-foreground mt-1">Cast</h1>
          <Link className="mt-2 inline-block text-sm text-muted transition-colors hover:text-primary" href={mediaHref}>
            {mediaTitle}
          </Link>
        </div>
        <span className="text-sm text-muted">{characters.length} characters</span>
      </div>

      {characters.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {characters.map((character) => (
            <Link
              className="character-card group"
              href={`/characters/${character.malId}`}
              key={character.malId}
            >
              <span className="relative aspect-[3/4] w-full overflow-hidden border border-line bg-surface-strong">
                {character.imageUrl ? (
                  <Image
                    alt={character.name}
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 180px"
                    src={character.imageUrl}
                  />
                ) : null}
              </span>
              <span className="min-w-0 space-y-1">
                <span className="line-clamp-1 text-sm font-semibold text-foreground">{character.name}</span>
                <span className="block text-xs uppercase tracking-[0.16em] text-muted">{character.role ?? "Character"}</span>
                <span className="block text-xs text-muted/70">{character.favorites.toLocaleString("en-US")} favorites</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <article className="panel">
          <p className="text-sm text-muted">No characters listed.</p>
        </article>
      )}
    </section>
  );
}
