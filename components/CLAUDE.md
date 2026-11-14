# components/: UI

- `ui/`: owned primitives (button, card, badge) in the shadcn style: Tailwind classes on brand
  tokens, variants as plain maps, `cn()` from `lib/cn.ts`. Extend these before adding a new one.
- Site blocks: search form (+ loader skeleton), flight line, stars, header, footer, hero media,
  test-mode note.
- `checkout/`: client state (chosen transfer + latest price check, `checkout-state.tsx`),
  `SessionInit` (hands the server's first check to the client), `CheckoutTotal` + `PayPanel`
  (status box and buttons calling the server actions), transfer picker, `TravellerForm` (traveller
  details the suppliers need; rules in `lib/travellers.ts`, sources in `docs/BOOKING-DATA.md`;
  personal data stays in memory, never storage or URLs). `sold-out-note.tsx`: the
  banner on offer/results after a sold-out redirect.

## Rules

- Client components receive view models from `lib/server/view.ts` / `lib/server/checkout.ts` only
  and never compute a price. A preview may add up server prices (package + another transfer), labelled
  as checked at "Till betalning"; once a check covers the choice, every amount shown comes from it.
- No supplier or provider names in copy or code here; copy is Swedish.
- Design follows heyholiday.com (radii 8/10/14, 1152px container, card shadow, pills): use the
  theme tokens that encode it, not literal values.
