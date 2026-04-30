import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";

const protectedPrefixes = ["/home", "/settings", "/library", "/feed"];
const authProxy = auth.middleware({
  loginUrl: "/auth/sign-in",
});

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return authProxy(request);
  }

  return NextResponse.next();
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
