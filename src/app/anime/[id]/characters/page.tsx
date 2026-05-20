import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { MediaCastPage } from "@/components/characters/media-cast-page";
import { isExplicitMediaPayload } from "@/lib/content-preferences";
import { fetchMediaCharacters } from "@/lib/jikan/client";
import { getMediaDetail } from "@/lib/media-data";
import { ensureViewerProfile } from "@/lib/viewer-profile";

type AnimeCastPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AnimeCastPage({ params }: AnimeCastPageProps) {
  const viewer = await ensureViewerProfile();

  if (!viewer) {
    redirect("/auth/sign-in");
  }

  const { id } = await params;
  const malId = Number(id);

  if (!Number.isInteger(malId) || malId <= 0) {
    notFound();
  }

  const [media, characters] = await Promise.all([
    getMediaDetail(malId, "anime"),
    fetchMediaCharacters(malId, "anime").catch(() => []),
  ]);

  if (!viewer.showAdultContent && isExplicitMediaPayload(media.payload, "anime")) {
    notFound();
  }

  return (
    <main className="app-shell animate-fade-in-up">
      <AppHeader avatarUrl={viewer.avatarUrl} nickname={viewer.nickname} username={viewer.username} viewerId={viewer.id} />
      <MediaCastPage
        mediaTitle={media.title}
        mediaHref={`/anime/${media.malId}`}
        mediaType="anime"
        characters={characters}
      />
    </main>
  );
}
