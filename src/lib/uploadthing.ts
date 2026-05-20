import "server-only";

import { UTApi } from "uploadthing/server";

import { env } from "@/lib/env";

export const utapi = new UTApi({
  token: env.UPLOADTHING_TOKEN,
});

export function isUploadThingConfigured() {
  return Boolean(env.UPLOADTHING_TOKEN);
}
