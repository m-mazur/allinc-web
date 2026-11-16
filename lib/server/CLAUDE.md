# lib/server/: API client, view models, sealing (server-only)

Every file starts with `import "server-only"`. Nothing here may be imported by a client component.

- `api.ts`: typed client, **one function per public API route** (`destinations`, `airports`, `search`,
  `content`, `offer`, `transfers`, `checkout.start|get|revalidate|confirm|book|extras|setExtras`).
  `extras` = `GET /checkout/{id}/extras` (bags and seat maps, customer prices); `setExtras` = `PUT` the
  choice, priced live, answers the checkout. Their errors: 409 `NotPossible` | `ExtrasUnavailable`, 400
  `BadExtras`, 429, 503. Replay makes extras up from the recorded flight (`replay-extras.ts`;
  `ALLINC_REPLAY_EXTRAS=none` sells none, `gone` sells out row 1 when chosen). `book` (test
  bookings only) sends the travellers once, Idempotency-Key = sha256(checkout id + "book"), 150 s
  timeout, never retried; replay answers `dev/fixtures/checkout/book-<ALLINC_REPLAY_BOOKING>.json`
  (confirmed | failed | attention). The API answers 200 for every outcome; Swedish copy comes from its
  `messageCode` (`BOOKING_SV` in checkout.ts), never from `customerMessage` (English staff text).
  Errors: 409 NotBookable, 400 InvalidTravellers, 403 BookingDisabled, 404. Checkout calls send
  `Idempotency-Key` and `X-Allinc-Web-Key` (`ALLINC_WEB_KEY`, = the API's `Checkout:WebKey`). `Raw*` types are API shapes and never leave this folder.
  Modes via `ALLINC_API_MODE`: `live`, `record` (saves to `dev/fixtures`), `replay` (offline;
  offer/transfers fall back to any recorded hotel; filters and swaps are not re-applied; checkout
  applies room/flight swaps to the recorded offer the way the API does (`replaySwaps`); checkout
  answers from `dev/fixtures/checkout/` (statuses; hold 20 min, or `ALLINC_REPLAY_HOLD_SECONDS`; amounts taken from the recorded offer and
  transfer fixtures for the chosen hotel, so they match the offer page): first check Ok, "Till betalning" per
  `ALLINC_REPLAY_CHECKOUT` = ok | changed | soldout-flight | soldout-room | soldout-hotel |
  soldout-transfer | cannotconfirm | expired).
- `checkout.ts`: the checkout flow and its Swedish copy. Sealed checkout ref (`checkout.v2`: API
  checkout id, trip, market, transfer, extras the session holds (`ex`), total last shown, 2 h).
  Extras ids are the API's own opaque hashes (no supplier data), so they go to the browser unsealed;
  the server re-cleans them (`cleanExtras`) and the API knows only ids it showed for that checkout.
  `mapExtras` picks the public extras view (`ExtrasModel`). Transfer ids are sealed (`transfer.v1`).
  **Amounts never come from the browser**: confirm sends the total sealed when it was shown.
  New checks are limited (6/h per IP from X-Forwarded-For/X-Real-IP, 120/h total) to protect
  supplier quota; the same trip + transfer within the hour reuses the API session.
- `view.ts`: public view models. Every field picked by hand. Supplier test airline code ZZ shows as
  "Testflyg". Image URLs become `/bild/<sealed>`.
- `seal.ts`: AES-256-GCM sealed refs with a purpose string (`trip.v1`, `img.v1`, `checkout.v2`,
  `transfer.v1`), 24 h expiry for trips.
  Bump the purpose version when a sealed shape changes.
- `env.ts`: server-only settings. `testBookings` (`ALLINC_TEST_BOOKINGS=1`) turns on "Boka testresa". `reference.ts`, `search-params.ts`, `defaults.ts`: search inputs.

## Security rules

- Never return or pass to a page: the API's checkout id or transfer option ids (sealed only),
  provider/supplier names, hotel keys, flight tokens, room/rate keys,
  supplier cost, markup, FX details, `sources`, `diagnostics`, `flightsLiveMode`.
- Adding a field to a view model: check it against the list above, then run `scripts/check-leaks.sh`.
  Add new forbidden words (a new supplier's name or host) to its pattern.
- Never call internal API routes (`/ops*`, `/hotels/search`, `/flights/*`, `/viewer`); in production
  they are 404 anyway.
- Never add `NEXT_PUBLIC_` variables. The API URL is a private-network address.
- Content language costs one supplier content call per language (`CONTENT_LANGUAGE`, `en` for now).
