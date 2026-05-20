import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { MediaCharactersSection } from "@/components/characters/media-characters-section";
import { saveAnimeEntryAction } from "@/lib/library-actions";
import { AnimeTrackingModal } from "@/components/library/tracking-modal";
import { QuickTrackingDropdown } from "@/components/library/quick-tracking-dropdown";
import { isExplicitMediaPayload } from "@/lib/content-preferences";
import { fetchMediaCharacters } from "@/lib/jikan/client";
import { getMediaDetail, getViewerAnimeEntry, getViewerAnimeFavorite } from "@/lib/media-data";
import { ensureViewerProfile } from "@/lib/viewer-profile";

type AnimePageProps = {
  params: Promise<{
    id: string;
  }>;
};

type NamedEntry = {
  mal_id: number;
  name: string;
};

export default async function AnimeDetailPage({ params }: AnimePageProps) {
  const viewer = await ensureViewerProfile();

  if (!viewer) {
    redirect("/auth/sign-in");
  }

  const { id } = await params;
  const malId = Number(id);

  if (!Number.isInteger(malId) || malId <= 0) {
    notFound();
  }

  const [media, entry, isFavorite, characters] = await Promise.all([
    getMediaDetail(malId, "anime"),
    getViewerAnimeEntry(viewer.id, malId),
    getViewerAnimeFavorite(viewer.id, malId),
    fetchMediaCharacters(malId, "anime").catch(() => []),
  ]);

  const payload = media.payload as {
    score?: number | null;
    scored_by?: number | null;
    status?: string | null;
    episodes?: number | null;
    year?: number | null;
    season?: string | null;
    source?: string | null;
    rating?: string | null;
    duration?: string | null;
    aired?: { string?: string | null };
    broadcast?: { string?: string | null };
    genres?: NamedEntry[];
    themes?: NamedEntry[];
    demographics?: NamedEntry[];
    studios?: NamedEntry[];
    producers?: NamedEntry[];
    licensors?: NamedEntry[];
    trailer?: { url?: string | null };
  };
  const allTags = [
    ...(payload.genres ?? []),
    ...(payload.themes ?? []),
    ...(payload.demographics ?? []),
  ];

  if (!viewer.showAdultContent && isExplicitMediaPayload(payload, "anime")) {
    notFound();
  }

  return (
    <main className="app-shell animate-fade-in-up">
      <AppHeader avatarUrl={viewer.avatarUrl} nickname={viewer.nickname} username={viewer.username} viewerId={viewer.id} />

      <section className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-4 animate-fade-in-up animate-delay-100">
          <div className="group relative aspect-[3/4] overflow-hidden border border-line bg-surface-strong">
            {media.imageUrl ? (
              <Image alt={media.title} className="object-cover transition-transform duration-500 group-hover:scale-105" fill loading="eager" sizes="288px" src={media.imageUrl} />
            ) : null}
          </div>

          <div className="flex flex-col gap-2 relative z-10">
                        <QuickTrackingDropdown
              key={`${media.malId}:${entry?.status ?? "new"}:${entry ? "existing" : "new"}`}
              mediaType="anime"
              malId={media.malId}
              hasEntry={!!entry}
              currentStatus={entry?.status ?? null}
              modalId="tracking-modal"
              className="w-full"
            />
            {payload.trailer?.url ? (
              <a className="button button-ghost w-full justify-center" href={payload.trailer.url} rel="noreferrer" target="_blank">
                Watch trailer
              </a>
            ) : null}
          </div>

          <div className="panel space-y-3 text-sm">
            <div className="fact-row"><span>format</span><strong className="uppercase tracking-wide text-xs">anime</strong></div>
            <div className="fact-row"><span>status</span><strong>{payload.status ?? "-"}</strong></div>
            <div className="fact-row"><span>episodes</span><strong>{payload.episodes ?? "-"}</strong></div>
            <div className="fact-row"><span>season</span><strong>{payload.season ? `${payload.season} ${payload.year ?? ""}`.trim() : payload.year ?? "-"}</strong></div>
            <div className="fact-row"><span>source</span><strong>{payload.source ?? "-"}</strong></div>
            <div className="fact-row"><span>duration</span><strong>{payload.duration ?? "-"}</strong></div>
            <div className="fact-row"><span>rating</span><strong>{payload.rating ?? "-"}</strong></div>
            <div className="fact-row"><span>aired</span><strong>{payload.aired?.string ?? "-"}</strong></div>
            <div className="fact-row"><span>broadcast</span><strong>{payload.broadcast?.string ?? "-"}</strong></div>
          </div>

          <div className="panel space-y-3">
             <p className="eyebrow tracking-widest text-[10px]">Production</p>
            <div className="space-y-2 text-sm text-muted">
              <p><span className="text-foreground">Studios:</span> {(payload.studios ?? []).map((studio) => studio.name).join(", ") || "Not listed"}</p>
              <p><span className="text-foreground">Production:</span> {(payload.producers ?? []).map((producer) => producer.name).join(", ") || "Not listed"}</p>
            </div>
          </div>

          <div className="panel space-y-3">
            <p className="eyebrow tracking-widest text-[10px]">Tags</p>
            <div className="flex flex-wrap gap-2">
              {allTags.length ? allTags.map((tag) => <span className="tag" key={`${tag.mal_id}-${tag.name}`}>{tag.name}</span>) : <span className="text-sm text-muted">No genres listed.</span>}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <section className="animate-fade-in-up animate-delay-200">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="stack max-w-2xl">
                <p className="eyebrow tracking-widest text-[10px] text-muted">Anime</p>
                <h1 className="font-display text-5xl leading-none text-foreground tracking-tight mt-1">{media.title}</h1>
                <p className="text-lg text-muted/60 mt-3 font-medium">
                  {media.titleJapanese || media.titleEnglish || ""}
                </p>
              </div>

              {payload.score ? (
                <div className="shrink-0 flex flex-col items-center justify-center border border-line bg-surface-strong w-24 h-24">
                  <span className="text-xs uppercase tracking-widest text-muted/60 mb-1">Score</span>
                  <strong className="font-display text-4xl text-foreground leading-none">{payload.score}</strong>
                  <span className="text-[10px] text-muted/40 mt-1">{payload.scored_by?.toLocaleString("en-US")} users</span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="animate-fade-in-up animate-delay-300">
            <p className="text-base leading-relaxed text-muted/90 max-w-4xl">
              {media.synopsis || "No synopsis on Jikan."}
            </p>
          </section>

          <MediaCharactersSection characters={characters} castHref={`/anime/${media.malId}/characters`} />
        </div>
      </section>

      <AnimeTrackingModal
        malId={media.malId}
        title={media.title}
        imageUrl={media.imageUrl}
        titleJapanese={media.titleJapanese}
        action={saveAnimeEntryAction}
        hasEntry={!!entry}
        defaultStatus={entry?.status ?? "plan_to_watch"}
        defaultScore={entry?.score ?? ""}
        defaultProgress={entry?.progressEpisodes ?? 0}
        maxEpisodes={payload.episodes ?? null}
        initialIsFavorite={isFavorite}
      />
    </main>
  );
}





