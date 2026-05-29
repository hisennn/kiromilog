"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  consumeRateLimit,
  getClientIpFromCurrentRequest,
} from "@/lib/rate-limit";
import { AVATAR_MAX_UPLOAD_MB } from "@/lib/settings";
import { isUploadThingConfigured, utapi } from "@/lib/uploadthing";
import { ensureViewerProfile } from "@/lib/viewer-profile";

const avatarExtensionsByMimeType = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const adultContentPreferenceSchema = z.boolean();

function revalidateViewerRoutes(username: string) {
  revalidatePath("/settings");
  revalidatePath(`/u/${username}`);
  revalidatePath("/home");
}

function matchesAvatarSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return pngSignature.every((byte, index) => buffer[index] === byte);
  }

  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }

  return false;
}

function getUploadThingFileKey(avatarPath: string | null | undefined) {
  if (!avatarPath?.startsWith("uploadthing:")) {
    return null;
  }

  return avatarPath.slice("uploadthing:".length);
}

async function removeUploadedAvatar(avatarPath: string | null | undefined) {
  const fileKey = getUploadThingFileKey(avatarPath);

  if (!fileKey) {
    return;
  }

  await utapi.deleteFiles(fileKey).catch(() => undefined);
}

export async function uploadAvatarAction(formData: FormData) {
  const profile = await ensureViewerProfile({ allowCookieMutation: true });
  const ip = await getClientIpFromCurrentRequest();
  const rateLimit = await consumeRateLimit({
    key: `settings:avatar-upload:${ip}:${profile.id}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });

  if (!profile) {
    redirect("/auth/sign-in");
  }

  if (!rateLimit.allowed) {
    return { ok: false as const, message: "Too many uploads. Try again later." };
  }

  if (!isUploadThingConfigured()) {
    return { ok: false as const, message: "Avatar uploads are not configured." };
  }

  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, message: "Choose an image before uploading." };
  }

  const extension = avatarExtensionsByMimeType.get(file.type);

  if (!extension) {
    return { ok: false as const, message: "Use JPG, PNG, or WEBP for the avatar." };
  }

  const maxUploadBytes = AVATAR_MAX_UPLOAD_MB * 1024 * 1024;

  if (file.size > maxUploadBytes) {
    return {
      ok: false as const,
      message: "This image is over the 5 MB limit.",
    };
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  if (!matchesAvatarSignature(fileBuffer, file.type)) {
    return { ok: false as const, message: "Use a valid JPG, PNG, or WEBP image." };
  }

  const uploadFile = new File(
    [fileBuffer],
    `${profile.id}-${Date.now()}.${extension}`,
    {
      type: file.type,
      lastModified: file.lastModified,
    },
  );
  const uploaded = await utapi.uploadFiles(uploadFile, {
    acl: "public-read",
  });

  if (uploaded.error) {
    return { ok: false as const, message: "Could not upload the image right now." };
  }

  const avatarUrl = uploaded.data.ufsUrl;
  const avatarPath = `uploadthing:${uploaded.data.key}`;

  await db
    .update(users)
    .set({
      avatarUrl,
      avatarPath,
      updatedAt: new Date(),
    })
    .where(eq(users.id, profile.id));

  await removeUploadedAvatar(profile.avatarPath);
  revalidateViewerRoutes(profile.username);

  return { ok: true as const, avatarUrl };
}

export async function removeAvatarAction() {
  const profile = await ensureViewerProfile({ allowCookieMutation: true });
  const ip = await getClientIpFromCurrentRequest();
  const rateLimit = await consumeRateLimit({
    key: `settings:avatar-remove:${ip}:${profile.id}`,
    limit: 30,
    windowMs: 60 * 1000,
  });

  if (!profile) {
    redirect("/auth/sign-in");
  }

  if (!rateLimit.allowed) {
    return { ok: false as const };
  }

  await db
    .update(users)
    .set({
      avatarUrl: null,
      avatarPath: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, profile.id));

  await removeUploadedAvatar(profile.avatarPath);
  revalidateViewerRoutes(profile.username);

  return { ok: true as const };
}

export async function updateAdultContentPreferenceAction(enabled: boolean) {
  const parsedEnabled = adultContentPreferenceSchema.safeParse(enabled);

  if (!parsedEnabled.success) {
    return { ok: false as const };
  }

  const profile = await ensureViewerProfile({ allowCookieMutation: true });
  const ip = await getClientIpFromCurrentRequest();
  const rateLimit = await consumeRateLimit({
    key: `settings:adult-content:${ip}:${profile.id}`,
    limit: 30,
    windowMs: 60 * 1000,
  });

  if (!profile) {
    redirect("/auth/sign-in");
  }

  if (!rateLimit.allowed) {
    return { ok: false as const };
  }

  await db
    .update(users)
    .set({
      showAdultContent: parsedEnabled.data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, profile.id));
  revalidateViewerRoutes(profile.username);

  return { ok: true as const, enabled: parsedEnabled.data };
}
