# lib/server/: API client, view models, sealing (server-only)

Every file starts with `import "server-only"`. Nothing here may be imported by a client component.

- `api.ts`: typed client, **one function per public API route** (`destinations`, `airports`, `search`,
  `content`, `offer`, `transfers`). `Raw*` types are API shapes and never leave this folder.
  Modes via `ALLINC_API_MODE`: `live`, `record` (saves to `dev/fixtures`), `replay` (offline;
  offer/transfers fall back to any recorded hotel; filters and swaps are not re-applied).
- `view.ts`: public view models. Every field picked by hand. Supplier test airline code ZZ shows as
  "Testflyg". Image URLs become `/bild/<sealed>`.
- `seal.ts`: AES-256-GCM sealed refs with a purpose string (`trip.v1`, `img.v1`), 24 h expiry.
  Bump the purpose version when a sealed shape changes.
- `env.ts`: server-only settings. `reference.ts`, `search-params.ts`, `defaults.ts`: search inputs.

## Security rules

- Never return or pass to a page: provider/supplier names, hotel keys, flight tokens, room/rate keys,
  supplier cost, markup, FX details, `sources`, `diagnostics`, `flightsLiveMode`.
- Adding a field to a view model: check it against the list above, then run `scripts/check-leaks.sh`.
  Add new forbidden words (a new supplier's name or host) to its pattern.
- Never call internal API routes (`/ops*`, `/hotels/search`, `/flights/*`, `/viewer`); in production
  they are 404 anyway.
- Never add `NEXT_PUBLIC_` variables. The API URL is a private-network address.
- Content language costs one supplier content call per language (`CONTENT_LANGUAGE`, `en` for now).
