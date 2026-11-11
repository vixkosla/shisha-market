import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isOperatorLegalPath } from "@/lib/legal-indexing";
import { wikiReviewPending } from "@/lib/wiki-review";
import { isExampleListing } from "@/lib/listing-examples";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const locale =
    pathname === "/en" || pathname.startsWith("/en/") ? "en" : "ru";
  const headers = new Headers(request.headers);
  headers.set("x-shisha-locale", locale);
  const response = NextResponse.next({ request: { headers } });
  if (isOperatorLegalPath(pathname))
    response.headers.set("X-Robots-Tag", "noindex, follow, nosnippet");
  else if (pathname.startsWith("/wiki/") && wikiReviewPending(pathname.slice(6).replace(/\/$/, "")))
    response.headers.set("X-Robots-Tag", "noindex, follow");
  else if (pathname.startsWith("/listings/") && isExampleListing(pathname.slice(10).replace(/\/$/, "")))
    response.headers.set("X-Robots-Tag", "noindex, follow");
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
