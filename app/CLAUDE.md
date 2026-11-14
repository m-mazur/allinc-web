# app/: routes

Every page lives under `app/[brand]/`; `proxy.ts` rewrites the visitor's path using the Host
header, so the brand segment is never chosen by the visitor. Paths are Swedish.

| Route | What | API calls |
|---|---|---|
| `[brand]/page.tsx` | Home: hero, search form, featured destinations | reference data |
| `[brand]/sok` | Results. Filters, sort, paging are links (searchParams) | `search`, then `content` streamed in for card photos |
| `[brand]/resa/[ref]` | One hotel's offer: winning package, rooms and flights as +/- deltas, swaps | `offer` + `content` in parallel |
| `[brand]/kassa/[ref]` | Checkout (dummy: nothing paid or booked yet) | `offer`, then `transfers` streamed in its own Suspense |
| `bild/[token]` | Image proxy: unseals the URL, allowlisted hosts only, else 404 | supplier image host |

## Rules

- `[ref]` is a sealed trip ref (`tripRef`/`openTripRef` in `lib/server/view.ts`); an invalid or
  expired one is `notFound()`, never an error page with details.
- Each page: a static shell + `<Suspense>` around an async part that starts with `await connection()`.
- Slow or optional calls (content, transfers) get their own Suspense so they never block prices.
- The transfer suggestion is a checkout upsell; it never changes the package price shown before.
- Real checkout (in progress in the backend): `POST /checkout` from the server with the
  `X-Allinc-Web-Key` secret, the checkout id sealed again for the browser, pay only on status Ok.
  Plan: `../allinc/backend/docs/CHECKOUT-VALIDATION.md`.
- New page that shows API data: add its path to `scripts/check-leaks.sh`.
