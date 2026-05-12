import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { saveMangaEntryAction } from "@/lib/library-actions";
import { MangaTrackingModal } from "@/components/library/tracking-modal";
import { QuickTrackingDropdown } from "@/components/library/quick-tracking-dropdown";
import { isExplicitMediaPayload } from "@/lib/content-preferences";
import { getMediaDetail, getViewerMangaEntry } from "@/lib/media-data";
import { ensureViewerProfile } from "@/lib/viewer-profile";

type MangaPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type NamedEntry = {
  mal_id: number;
  name: string;
};

export default async function MangaDetailPage({ params }: MangaPageProps) {
  const viewer = await ensureViewerProfile();

  if (!viewer) {
    redirect("/auth/sign-in");
  }

  const { id } = await params;
  const malId = Number(id);

  if (!Number.isInteger(malId) || malId <= 0) {
    notFound();
  }

  const [media, entry] = await Promise.all([
    getMediaDetail(malId, "manga"),
    getViewerMangaEntry(viewer.id, malId),
  ]);

  const payload = media.payload as {
    score?: number | null;
    scored_by?: number | null;
    status?: string | null;
    chapters?: number | null;
    volumes?: number | null;
    source?: string | null;
    published?: { string?: string | null; prop?: { from?: { year?: number | null } } };
    genres?: NamedEntry[];
    themes?: NamedEntry[];
    demographics?: NamedEntry[];
    authors?: Array<{ mal_id: number; name: string; type?: string | null }>;
    serializations?: NamedEntry[];
  };
  const allTags = [
    ...(payload.genres ?? []),
    ...(payload.themes ?? []),
    ...(payload.demographics ?? []),
  ];

  if (!viewer.showAdultContent && isExplicitMediaPayload(payload, "manga")) {
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
              mediaType="manga"
              malId={media.malId}
              hasEntry={!!entry}
              currentStatus={entry?.status ?? null}
              modalId="tracking-modal"
              className="w-full"
            />
          </div>

          <div className="panel space-y-3 text-sm">
            <div className="fact-row"><span>format</span><strong className="uppercase tracking-wide text-xs">manga</strong></div>
            <div className="fact-row"><span>status</span><strong>{payload.status ?? "-"}</strong></div>
            <div className="fact-row"><span>chapters</span><strong>{payload.chapters ?? "-"}</strong></div>
            <div className="fact-row"><span>volumes</span><strong>{payload.volumes ?? "-"}</strong></div>
            <div className="fact-row"><span>source</span><strong>{payload.source ?? "-"}</strong></div>
            <div className="fact-row"><span>start</span><strong>{payload.published?.prop?.from?.year ?? "-"}</strong></div>
          </div>

          <div className="panel space-y-3">
             <p className="eyebrow tracking-widest text-[10px]">Credits</p>
            <div className="space-y-2 text-sm text-muted">
              <p><span className="text-foreground">Authors:</span> {(payload.authors ?? []).map((author) => `${author.name}${author.type ? ` (${author.type})` : ""}`).join(", ") || "Not listed"}</p>
              <p><span className="text-foreground">Publishing:</span> {(payload.serializations ?? []).map((entryItem) => entryItem.name).join(", ") || "Not listed"}</p>
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
                <p className="eyebrow tracking-widest text-[10px] text-muted">Manga</p>
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
        </div>
      </section>

      <MangaTrackingModal
        malId={media.malId}
        title={media.title}
        imageUrl={media.imageUrl}
        titleJapanese={media.titleJapanese}
        action={saveMangaEntryAction}
        hasEntry={!!entry}
        defaultStatus={entry?.status ?? "plan_to_read"}
        defaultScore={entry?.score ?? ""}
        defaultChapters={entry?.progressChapters ?? 0}
        defaultVolumes={entry?.progressVolumes ?? 0}
        maxChapters={payload.chapters ?? null}
        maxVolumes={payload.volumes ?? null}
      />
    </main>
  );
}





