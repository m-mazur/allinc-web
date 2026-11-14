import { unsealStable } from "@/lib/server/seal";

// Image proxy. Pages only ever link /bild/<sealed url>, so the browser never sees a supplier's
// image host. Only URLs we sealed can be fetched (no open proxy), and only from known hosts.
const ALLOWED_HOSTS = new Set(["photos.hotelbeds.com", "assets.htxstaging.com", "assets.hotelbeds.com"]);

export async function GET(_req: Request, ctx: RouteContext<"/bild/[token]">) {
  const { token } = await ctx.params;
  const url = unsealStable("img.v1", token);
  if (!url) return new Response("Not found", { status: 404 });
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    host = u.hostname;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!ALLOWED_HOSTS.has(host)) return new Response("Not found", { status: 404 });

  const upstream = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
  const type = upstream?.headers.get("content-type") ?? "";
  if (!upstream?.ok || !type.startsWith("image/")) return new Response("Not found", { status: 404 });

  return new Response(upstream.body, {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=604800, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
