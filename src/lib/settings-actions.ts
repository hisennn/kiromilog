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
import { ensureViewerProfile } from "@/lib/viewer-profile";

const allowedAvatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
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

export async function uploadAvatarAction(formData: FormData) {
  const profile = await ensureViewerProfile({ allowCookieMutation: true });
  const ip = await getClientIpFromCurrentRequest();
  const rateLimit = consumeRateLimit({
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

  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, message: "Choose an image before uploading." };
  }

  if (!allowedAvatarMimeTypes.has(file.type)) {
    return { ok: false as const, message: "Use JPG, PNG, or WEBP for the avatar." };
  }

  const maxUploadBytes = AVATAR_MAX_UPLOAD_MB * 1024 * 1024;

  if (file.size > maxUploadBytes) {
    return {
      ok: false as const,
      message: "Esta imagem passa do limite de 5 MB.",
    };
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  if (!matchesAvatarSignature(fileBuffer, file.type)) {
    return { ok: false as const, message: "Use a valid JPG, PNG, or WEBP image." };
  }

  const avatarUrl = `data:${file.type};base64,${fileBuffer.toString("base64")}`;

  await db
    .update(users)
    .set({
      avatarUrl,
      avatarPath: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, profile.id));

  revalidateViewerRoutes(profile.username);

  return { ok: true as const, avatarUrl };
}

export async function removeAvatarAction() {
  const profile = await ensureViewerProfile({ allowCookieMutation: true });
  const ip = await getClientIpFromCurrentRequest();
  const rateLimit = consumeRateLimit({
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
  const rateLimit = consumeRateLimit({
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
