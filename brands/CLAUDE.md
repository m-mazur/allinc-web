# brands/: white labels and themes

One build serves every brand; the Host header picks one (`proxy.ts` → `brandIdForHost`).

- `index.ts`: the `Brand` type and registry. Imported by `proxy.ts`, so it must stay plain data
  (no server-only or React imports).
- `<id>/brand.ts`: name, hosts, **market** (SE/NO/DK/FI, decides currency and prices via the API),
  locale, logo, hero, featured destinations (our destination ids), contact, default origin.
- `<id>/theme.css`: CSS variables only (`--brand-primary`, radii, shadows, fonts). `allinc` is also
  the fallback for every token. Logos and media in `public/brands/<id>/`.

## Adding a brand

Copy `solkusten` (the made-up demo brand), set hosts, market and tokens, add logo files, register it
in `index.ts`, `@import` its theme.css in `app/globals.css`, open `<host>.localhost:3000`.

## Rules

- Components use tokens, never brand-specific values; a brand changes only these files and its assets.
- Fonts: Google Fonts or other open-licence fonts via `next/font` only, no paid fonts.
- Allinc brand: lowercase "allinc" logo, direction D, Sky palette (FOUNDATION.md §5).
- Media licences are tracked in `docs/MEDIA-SOURCES.md`; add a row for every new photo or video.
