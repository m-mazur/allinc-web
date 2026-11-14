@AGENTS.md

# allinc-web: public booking site

The customer-facing site for Allinc and its white labels: search → results → offer → checkout for
flight + hotel packages. Next.js 16 (App Router, Cache Components), TypeScript, Tailwind 4. Talks
only to `allinc-api` (sibling repo `../allinc`, own CLAUDE.md), and only from the server.
Design and decisions: `FOUNDATION.md`. Run modes and security model: `README.md`.

Each area has its own short CLAUDE.md: `app/`, `lib/server/`, `brands/`, `components/`.

## Architecture map

```
browser ─▶ proxy.ts (Host → brand, rewrite to /<brand>/...)
        ─▶ app/[brand]/  home · sok (results) · resa/[ref] (offer) · kassa/[ref] (checkout)
              └▶ lib/server/api.ts (server-only, public API routes only) ─▶ allinc-api
              └▶ lib/server/view.ts (hand-picked public view models; the ONLY data pages get)
              └▶ lib/server/checkout.ts + lib/actions/checkout.ts (live price check at checkout)
        ─▶ app/bild/[token]  image proxy for sealed supplier photo URLs
```

## Run

```bash
npm install && cp .env.example .env.local
ALLINC_API_MODE=replay npm run dev     # offline from dev/fixtures: spends no supplier quota (default choice)
npm run dev                            # live against the API on :8080: cache misses spend Hotelbeds quota
npm run lint && npm run build
scripts/check-leaks.sh                 # after build, with the server running: must print "clean"
```

http://localhost:3000 is Allinc, http://solkusten.localhost:3000 the demo white label. Full stack:
`docker compose up --build` (api with internal routes off and no host port + web). Don't start
compose's api casually: a fresh API cache means live Hotelbeds calls.

## Conventions

- Next 16 differs from what you know: read `node_modules/next/dist/docs/` first (see AGENTS.md).
  Middleware is `proxy.ts`. Request-time work (searchParams, clock, API) needs `await connection()`
  inside a `<Suspense>` boundary.
- Server components fetch; client components (`"use client"`) only hold UI state and never price.
- Styling by brand tokens only (`bg-primary`, `rounded-card`, `font-heading`), never hex colours in components.
- All customer copy is Swedish. Design language follows heyholiday.com with our own logo and colours.
- No test runner yet: lint, build, click through in replay mode, run `check-leaks.sh`.

## Hard rules

1. **The browser never sees** supplier or provider names, supplier prices, markup, FX rates or
   source, hotel keys, flight tokens, rate keys, cache traces, diagnostics or `/ops`.
2. Everything from the API goes through `lib/server/view.ts`; never spread an API object into props.
3. Anything the browser hands back (hotel, flight, room, image URL) is a **sealed ref** (`lib/server/seal.ts`).
4. Call only public API routes. **Prices and content are separate calls**: search/offer for prices,
   `/hotels/content` for texts and photos; stream content in after prices.
5. The web does not cache search results or prices (the API owns caching); `fetch` uses `no-store`.
6. No `NEXT_PUBLIC_*` variables. `WEB_SEAL_KEY` and `ALLINC_WEB_KEY` are required in production.
   Amounts to pay come only from the API's checkout session, never from the browser.
7. **Hotelbeds quota is ~50/day (API caps 40; searches stop at 30, 10 are kept for checkout checks)**:
   build and test pages in `replay` mode; use `record` only with Marcus's OK.
8. **Git:** `/usr/bin/git` only; other threads may be editing: commit only your own files.
   **Never push without Marcus's go-ahead** (remote: github.com/m-mazur/allinc-web, created by Marcus, empty).
9. **Keep these files true.** When you change a flow, rule or setting, update the relevant
   CLAUDE.md (and FOUNDATION.md / README.md) in the same commit.
