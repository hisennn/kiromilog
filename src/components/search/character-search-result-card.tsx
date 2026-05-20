import Image from "next/image";
import Link from "next/link";

type CharacterSearchResultCardProps = {
  item: {
    malId: number;
    name: string;
    nameKanji: string | null;
    nicknames: string[];
    about: string | null;
    imageUrl: string | null;
    favorites: number;
  };
};

export function CharacterSearchResultCard({ item }: CharacterSearchResultCardProps) {
  const subtitle = item.nameKanji || item.nicknames.slice(0, 2).join(", ");

  return (
    <article className="search-result-card group">
      <div className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden border border-line bg-surface-strong">
        {item.imageUrl ? (
          <Image alt={item.name} className="object-cover" fill sizes="80px" src={item.imageUrl} />
        ) : null}
      </div>

      <div className="search-result-copy">
        <div className="space-y-2">
          <Link
            className="block font-display text-2xl leading-tight text-foreground transition-colors hover:text-primary"
            href={`/characters/${item.malId}`}
          >
            {item.name}
          </Link>
          {subtitle ? (
            <p className="text-sm text-muted">{subtitle}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="line-clamp-2 text-sm leading-6 text-muted">
            {item.about || "No character description available."}
          </p>
          <p className="text-xs uppercase tracking-[0.16em] text-muted/70">
            {item.favorites.toLocaleString("en-US")} favorites
          </p>
        </div>
      </div>
    </article>
  );
}
