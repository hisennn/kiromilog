import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const isDev = process.env.NODE_ENV === "development";

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function createContentSecurityPolicy(nonce: string) {
  const scriptSources = [`'self'`, `'nonce-${nonce}'`, "'strict-dynamic'"];
  const connectSources = [
    "'self'",
    "https://api.tenrai.org",
    "https://api.jikan.moe",
    "https://api.uploadthing.com",
    "https://*.ufs.sh",
    "https://*.uploadthing.com",
    "https://*.pusher.com",
    "wss://*.pusher.com",
  ];

  try {
    const authUrl = new URL(process.env.NEON_AUTH_BASE_URL ?? "");
    if (authUrl.protocol === "https:" || (isDev && authUrl.protocol === "http:")) {
      connectSources.push(authUrl.origin);
    }
  } catch {
    console.error("NEON_AUTH_BASE_URL is invalid; Auth connections are excluded from CSP.");
  }

  if (isDev) {
    scriptSources.push("'unsafe-eval'");
    connectSources.push("http://localhost:3000", "ws://localhost:3000");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    `script-src-elem ${scriptSources.join(" ")}`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://cdn.myanimelist.net https://myanimelist.net https://lh3.googleusercontent.com https://*.googleusercontent.com https://*.ufs.sh https://*.uploadthing.com",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${connectSources.join(" ")}`,
    "frame-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
