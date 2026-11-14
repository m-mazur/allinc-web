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
- The transfer suggestion is a checkout upsell; it never changes the package price shown before.
- Checkout flow (contract: `../allinc/backend/docs/CHECKOUT-VALIDATION.md`, "As built"):
  page load checks the package with the suggested transfer (`startCheckout`) → "Till betalning"
  (`payAction`) revalidates, or starts a new check if the transfer was changed → pay only on Ok.
  Changed: show old → new and "Godkänn nytt pris" (`confirmAction`, total from the sealed ref).
  SoldOut: link to the offer (`?slutsalt=flyg|rum`) or results (`?slutsalt=hotell`), which show
  `SoldOutNote`; a sold-out transfer stays in checkout. Expired / CannotConfirm / busy: "Kontrollera
  priset igen" (`recheckAction`). Payment itself is not built: an Ok after "Till betalning" says so.
- New page that shows API data: add its path to `scripts/check-leaks.sh`.
