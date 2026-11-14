#!/usr/bin/env bash
# Fails if a page or the client bundle shows anything the browser must not see:
# supplier/provider names, booking tokens, hotel keys, cost/markup/FX, internal routes, API address.
# Usage: scripts/check-leaks.sh [base-url]   (run after `npm run build`; base-url defaults to http://localhost:3000)
set -euo pipefail
BASE="${1:-http://localhost:3000}"
cd "$(dirname "$0")/.."
PATTERN='hotelbeds|duffel|ratehawk|\boff_[A-Za-z0-9]{6,}|hotelKey|flightToken|bookingToken|rateKey|markup|supplier|Frankfurter|\bECB\b|fixingDates|/ops|cacheExpiresAt|diagnostics|ALLINC_API|WEB_SEAL_KEY|localhost:8080|allinc-api|htxstaging|giata|checkoutId|\bco_[A-Za-z0-9]{4,}|optionId|Idempotency|X-Allinc-Web-Key'
fail=0

if [ -d .next/static ]; then
  hits=$(grep -rEoi "$PATTERN" .next/static | sort | uniq -c || true)
  if [ -n "$hits" ]; then echo "Client bundle:"; echo "$hits"; fail=1; else echo "Client bundle: clean"; fi
fi

tmp=$(mktemp -d)
search="$BASE/sok?from=ARN&to=es.barcelona&depart=2026-12-13&nights=3&adults=2"
curl -s --noproxy '*' "$search" -o "$tmp/search.html"
offer=$(grep -oE '/resa/[A-Za-z0-9_-]+' "$tmp/search.html" | sed -n 1p)
curl -s --noproxy '*' "$BASE$offer" -o "$tmp/offer.html"
kassa=$(grep -oE '/kassa/[A-Za-z0-9_-]+' "$tmp/offer.html" | sed -n 1p)
curl -s --noproxy '*' "$BASE$kassa" -o "$tmp/kassa.html"
curl -s --noproxy '*' "$BASE/" -o "$tmp/home.html"
for f in home search offer kassa; do
  size=$(wc -c < "$tmp/$f.html")
  hits=$(grep -Eoi "$PATTERN" "$tmp/$f.html" | sort | uniq -c || true)
  if [ "$size" -lt 2000 ]; then echo "$f: page too small ($size bytes), check it rendered"; fail=1;
  elif [ -n "$hits" ]; then echo "$f page:"; echo "$hits"; fail=1; else echo "$f page: clean ($size bytes)"; fi
done
rm -rf "$tmp"
exit $fail
