# components/: UI

- `ui/`: owned primitives (button, card, badge) in the shadcn style: Tailwind classes on brand
  tokens, variants as plain maps, `cn()` from `lib/cn.ts`. Extend these before adding a new one.
- Site blocks: search form (+ loader skeleton), flight line, stars, header, footer, hero media,
  test-mode note.
- `checkout/`: dummy checkout state (chosen transfer), summary and pay button, transfer picker.

## Rules

- Client components receive view models from `lib/server/view.ts` only and never compute a price:
  only add up customer prices the server already worked out (e.g. package + chosen transfer).
- No supplier or provider names in copy or code here; copy is Swedish.
- Design follows heyholiday.com (radii 8/10/14, 1152px container, card shadow, pills): use the
  theme tokens that encode it, not literal values.
