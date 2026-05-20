import Image from "next/image";
import Link from "next/link";

type MediaCharacter = {
  malId: number;
  name: string;
  imageUrl: string | null;
  role: string | null;
  favorites: number;
};

type MediaCharactersSectionProps = {
  characters: MediaCharacter[];
  castHref: string;
};

export function MediaCharactersSection({ characters, castHref }: MediaCharactersSectionProps) {
  if (!characters.length) {
    return null;
  }

  const visibleCharacters = characters.slice(0, 8);

  return (
    <section className="animate-fade-in-up animate-delay-300 space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow tracking-widest text-[10px] text-muted">Characters</p>
          <h2 className="font-display text-3xl text-foreground mt-1">Cast</h2>
        </div>
        {characters.length > 8 ? (
          <Link
            className="button button-ghost"
            href={castHref}
          >
            View more
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visibleCharacters.map((character) => (
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
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
