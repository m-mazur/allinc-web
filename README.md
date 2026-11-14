# allinc-web

The public booking site for Allinc and its white labels. Next.js 16 (App Router, Cache Components),
TypeScript, Tailwind 4. Talks to `allinc-api` (the `allinc` repo) from the server only.
Design and decisions: [FOUNDATION.md](FOUNDATION.md).

First slice: search form -> results -> offer page (swap room or flight) -> dummy checkout where the
transfer suggestion streams in. Nothing is paid or booked.

## Run it

```bash
npm install
cp .env.example .env.local

# Offline: answers from dev/fixtures (one recorded ARN -> Barcelona, 13 Dec, 3 nights, 2 adults search).
ALLINC_API_MODE=replay npm run dev

# Against the API container on :8080 (spends supplier quota on cache misses).
npm run dev
```

Open http://localhost:3000 (Allinc) or http://solkusten.localhost:3000 (the demo white label).

Whole stack in Docker (API with internal routes off and no host port, web on :3000):

```bash
echo "WEB_SEAL_KEY=$(/usr/bin/openssl rand -base64 48)" > .env
docker compose up --build
```

## API modes (save supplier quota)

| `ALLINC_API_MODE` | What happens |
|---|---|
| `live` (default) | Calls `ALLINC_API_URL` |
| `record` | Calls it and saves each response under `dev/fixtures` |
| `replay` | Answers from `dev/fixtures`, never calls the API. Offer and transfer fall back to any recorded hotel; filters and swaps are not re-applied |

## Security model

The browser talks only to this Next.js server. It never sees supplier or provider names, supplier
prices, markup, exchange rates, hotel keys, flight booking tokens, cache traces or `/ops`.

- `lib/server/*` is `server-only`. Pages get **public view models** (`lib/server/view.ts`) where every
  field is picked by hand; nothing from an API response is spread through.
- Anything the browser must hand back (which hotel, flight and room) travels as a **sealed reference**:
  AES-256-GCM with `WEB_SEAL_KEY`, purpose-bound, expires after 24 h (`lib/server/seal.ts`).
- Hotel and transfer photos go through `/bild/<sealed url>`, so supplier image hosts never appear.
  Only URLs we sealed, on an allowlist of hosts, can be fetched.
- The flight supplier's test-mode airline (named after the supplier) shows as "Testflyg".
- Only public API routes are called. In compose the API runs with `InternalRoutes__Enabled=false`
  and is not published to the host.
- No `NEXT_PUBLIC_*` variables. Security headers on every response, no `X-Powered-By`.
- `scripts/check-leaks.sh` greps the client bundle and four rendered pages for forbidden words
  (supplier names, tokens, markup, FX, internal routes, API address). Run it after `npm run build`
  with the server running.

## Brands

`proxy.ts` maps the Host header to a brand and rewrites to `app/[brand]/...`. A brand is
`brands/<id>/brand.ts` (name, hosts, market, logo, default airport) plus `brands/<id>/theme.css`
(CSS variables). Components use tokens only (`bg-primary`, `rounded-card`, `font-heading`).
