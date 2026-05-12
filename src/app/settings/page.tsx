import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { AdultContentSettingsPanel } from "@/components/settings/adult-content-settings-panel";
import { AvatarSettingsPanel } from "@/components/settings/avatar-settings-panel";
import { ensureViewerProfile } from "@/lib/viewer-profile";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await ensureViewerProfile();

  if (!profile) {
    redirect("/auth/sign-in");
  }

  return (
    <main className="app-shell animate-fade-in-up">
      <AppHeader avatarUrl={profile.avatarUrl} current="settings" nickname={profile.nickname} username={profile.username} viewerId={profile.id} />

      <section className="section-head animate-fade-in-up animate-delay-100">
        <div>
          <p className="eyebrow tracking-widest text-[10px] text-muted">Settings</p>
          <h1 className="font-display text-4xl text-foreground mt-1">Account</h1>
        </div>
        <p className="max-w-xl text-sm leading-7 text-muted mt-2">
          Adjust your profile photo and account preferences.
        </p>
      </section>

      <AvatarSettingsPanel
        avatarUrl={profile.avatarUrl}
        username={profile.username}
      />
      <AdultContentSettingsPanel enabled={profile.showAdultContent} />
    </main>
  );
}
