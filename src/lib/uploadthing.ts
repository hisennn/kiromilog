import "server-only";

import { UTApi } from "uploadthing/server";

import { env } from "@/lib/env";

let uploadThingApi: UTApi | null = null;

export function getUploadThingApi() {
  uploadThingApi ??= new UTApi({
    token: env.UPLOADTHING_TOKEN,
  });

  return uploadThingApi;
}

export const utapi = new Proxy({} as UTApi, {
  get(_target, property: keyof UTApi) {
    return getUploadThingApi()[property];
  },
});

export function isUploadThingConfigured() {
  return Boolean(env.UPLOADTHING_TOKEN);
}
