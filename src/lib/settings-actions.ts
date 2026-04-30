"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { AVATAR_MAX_UPLOAD_MB } from "@/lib/settings";
import { ensureViewerProfile } from "@/lib/viewer-profile";

const AVATAR_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const avatarMimeToExtension: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function revalidateViewerRoutes(username: string) {
  revalidatePath("/settings");
  revalidatePath(`/u/${username}`);
  revalidatePath("/home");
}

async function removeAvatarFile(avatarPath: string | null | undefined) {
  if (!avatarPath) {
    return;
  }

  const normalizedPath = path.normalize(avatarPath);
  const normalizedRoot = path.normalize(AVATAR_UPLOADS_DIR);

  if (!normalizedPath.startsWith(normalizedRoot)) {
    return;
  }

  await unlink(normalizedPath).catch(() => undefined);
}

export async function uploadAvatarAction(formData: FormData) {
  const profile = await ensureViewerProfile();

  if (!profile) {
    redirect("/auth/sign-in");
  }

  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, message: "Choose an image before uploading." };
  }

  const extension = avatarMimeToExtension[file.type];

  if (!extension) {
    return { ok: false as const, message: "Use JPG, PNG, or WEBP for the avatar." };
  }

  const maxUploadBytes = AVATAR_MAX_UPLOAD_MB * 1024 * 1024;

  if (file.size > maxUploadBytes) {
    return {
      ok: false as const,
      message: `This image is larger than the 5 MB limit.`,
    };
  }

  await mkdir(AVATAR_UPLOADS_DIR, { recursive: true });

  const fileName = `${profile.id}-${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(AVATAR_UPLOADS_DIR, fileName);
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, fileBuffer);

  const avatarUrl = `/uploads/avatars/${fileName}`;

  await db
    .update(users)
    .set({
      avatarUrl,
      avatarPath: filePath,
      updatedAt: new Date(),
    })
    .where(eq(users.id, profile.id));

  await removeAvatarFile(profile.avatarPath);
  revalidateViewerRoutes(profile.username);

  return { ok: true as const, avatarUrl };
}

export async function removeAvatarAction() {
  const profile = await ensureViewerProfile();

  if (!profile) {
    redirect("/auth/sign-in");
  }

  await db
    .update(users)
    .set({
      avatarUrl: null,
      avatarPath: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, profile.id));

  await removeAvatarFile(profile.avatarPath);
  revalidateViewerRoutes(profile.username);

  return { ok: true as const };
}

export async function updateAdultContentPreferenceAction(enabled: boolean) {
  const profile = await ensureViewerProfile();

  if (!profile) {
    redirect("/auth/sign-in");
  }

  await db
    .update(users)
    .set({
      showAdultContent: enabled,
      updatedAt: new Date(),
    })
    .where(eq(users.id, profile.id));
  revalidateViewerRoutes(profile.username);

  return { ok: true as const, enabled };
}
