# app/: routes

Every page lives under `app/[brand]/`; `proxy.ts` rewrites the visitor's path using the Host
header, so the brand segment is never chosen by the visitor. Paths are Swedish.

| Route | What | API calls |
|---|---|---|
| `[brand]/page.tsx` | Home: hero, search form, featured destinations | reference data |
| `[brand]/sok` | Results. Filters, sort, paging are links (searchParams) | `search`, then `content` streamed in for card photos |
| `[brand]/resa/[ref]` | One hotel's offer: winning package, rooms and flights as +/- deltas, swaps | `offer` + `content` in parallel |
| `[brand]/kassa/[ref]` | Checkout: live price check, no payment yet | `offer`; then in one Suspense `transfers` → `POST /checkout` with the suggested transfer. Buttons are server actions in `lib/actions/checkout.ts` |
| `bild/[token]` | Image proxy: unseals the URL, allowlisted hosts only, else 404 | supplier image host |

## Rules

- `[ref]` is a sealed trip ref (`tripRef`/`openTripRef` in `lib/server/view.ts`); an invalid or
  expired one is `notFound()`, never an error page with details.
- Each page: a static shell + `<Suspense>` around an async part that starts with `await connection()`.
- Slow or optional calls (content, transfers) get their own Suspense so they never block prices.
- The transfer is an add-on: checkout starts with **no transfer** (total = the offer price) and the
  first live check is flight + hotel only. Options show "+price"; once one is chosen, the others show
  +/- against it and "Ingen transfer" shows the minus, like room and flight swaps. "Vårt förslag" is a
  badge, never a preselection.
- Checkout flow (contract: `../allinc/backend/docs/CHECKOUT-VALIDATION.md`, "As built"):
  page load checks the package without a transfer (`startCheckout`) → "Till betalning"
  (`payAction`) revalidates, or starts a new check if the transfer was changed → pay only on Ok.
  Changed: show old → new and "Godkänn nytt pris" (`confirmAction`, total from the sealed ref).
  SoldOut: link to the offer (`?slutsalt=flyg|rum`) or results (`?slutsalt=hotell`), which show
  `SoldOutNote`; a sold-out transfer stays in checkout. Expired / CannotConfirm / busy: "Kontrollera
  priset igen" (`recheckAction`). Payment itself is not built: an Ok after "Till betalning" says so.
- Price hold countdown: shown while a check is Ok or Changed, from `secondsLeft` worked out on the
  server (not the device clock); amber under 5 minutes; at zero the client marks the check expired and
  offers "Kontrollera priset igen". The hold is the API session: 20 minutes from the check, or less if
  the flight offer expires sooner. Nothing is held at the suppliers: it is our price promise, and
  "Till betalning" checks live again when the last check is over 10 minutes old.
- "Till betalning" first validates the traveller details (`lib/travellers.ts`) on the server; field
  errors come back without any supplier call. Passport fields only when the flight needs them
  (`selected.passportRequired`, sealed into the checkout ref as `pp`). What each supplier needs:
  `docs/BOOKING-DATA.md`. Traveller data is never logged, stored, sealed or put in a URL.
- New page that shows API data: add its path to `scripts/check-leaks.sh`.
