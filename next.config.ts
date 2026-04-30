import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const neonAuthOrigin = process.env.NEON_AUTH_BASE_URL
  ? new URL(process.env.NEON_AUTH_BASE_URL).origin
  : "https://ep-nameless-sound-acasvz4j.neonauth.sa-east-1.aws.neon.tech";
const scriptSources = [`'self'`, "'unsafe-inline'"];

if (isDev) {
  scriptSources.push("'unsafe-eval'");
}

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSources.join(" ")}`,
  `script-src-elem ${scriptSources.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://cdn.myanimelist.net https://myanimelist.net https://lh3.googleusercontent.com https://*.googleusercontent.com",
  "font-src 'self' https://fonts.gstatic.com",
  `connect-src 'self' http://localhost:3000 ws://localhost:3000 https://api.jikan.moe ${neonAuthOrigin}`,
  "frame-src 'self' https://accounts.google.com",
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    localPatterns: [
      {
        pathname: "/uploads/avatars/**",
        search: "?v=*",
      },
      {
        pathname: "/uploads/avatars/**",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.myanimelist.net",
      },
      {
        protocol: "https",
        hostname: "myanimelist.net",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
