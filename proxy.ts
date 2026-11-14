import { NextResponse, type NextRequest } from "next/server";
import { brandIdForHost } from "./brands";

// Host -> brand. Every page lives under app/[brand]/; the visitor never sees the brand segment.
// The rewrite always prefixes the brand from the Host header, so a visitor cannot pick another
// brand by typing /solkusten/... (that becomes /allinc/solkusten/... and 404s).
export function proxy(request: NextRequest) {
  const brand = brandIdForHost(request.headers.get("host"));
  const url = request.nextUrl.clone();
  url.pathname = `/${brand}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Not for static files, image route, Next internals or files with an extension.
  matcher: ["/((?!_next/|bild/|brands/|favicon\\.ico|robots\\.txt|.*\\.[a-z0-9]+$).*)"],
};
