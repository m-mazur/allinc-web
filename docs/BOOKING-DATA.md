# Booking data: what each supplier needs, and what the checkout collects

Read from the official API docs on 2026-11-14. The checkout form (`components/checkout/traveller-form.tsx`)
collects these and `lib/travellers.ts` validates them, in the browser and again in the pay action.
Nothing is sent anywhere yet: the booking layer (backend) does not exist. When it does, the web sends
this data with the booking call and the backend maps it per supplier as below.

## Asked from the customer

| Field | Per | Rules | Used by |
|---|---|---|---|
| Gender (Kön) `m`/`f` | traveller | required | Duffel `gender`; also gives `title` (below) |
| Given name, family name | traveller | 2-50 each, Latin letters (ASCII, Latin-1, Latin Extended-A, not Æ æ Ĳ ĳ Œ œ Þ ð), space, `-`, `'`; together at most 40 | Duffel `given_name`/`family_name`; Hotelbeds pax `name`/`surname` (1-50); holder = traveller 1 |
| Date of birth | traveller | adults 18+ at departure; a child's age at the return date must equal the searched age | Duffel `born_on`; Hotelbeds child `age` (must equal the availability ages) |
| Email | booking | valid address | Duffel `email` (every passenger gets the lead's); Transfers `holder.email` |
| Mobile | booking | valid per libphonenumber (`libphonenumber-js`), read in the market's country when typed without a country code; sent as E.164 (`070…` and `+46 070…` both become `+4670…`) | Duffel `phone_number`; Transfers `holder.phone` |
| Passport number, issuing country, expiry | traveller, **only when the flight offer has `passenger_identity_documents_required`** | number 5-20 A-Z/0-9, ISO 3166 alpha-2, valid after the return date | Duffel `identity_documents[{type: passport, unique_identifier, issuing_country_code, expires_on}]` |
| Wishes to the hotel | booking, optional | at most 500 (Hotelbeds allows 2000) | Hotelbeds `remark` |

## Derived, never asked

| Field | From |
|---|---|
| Duffel `title` | gender: `m` → `mr`, `f` → `ms` (adults) / `miss` (children). `dr` is rejected by some airlines |
| Duffel passenger `id` | the offer request's passenger ids, in order (adults, then children) |
| Duffel `infant_passenger_id` | each infant (age 0-1) is attached to an adult |
| Hotelbeds `holder` | traveller 1 |
| Hotelbeds pax `type`/`roomId` | AD/CH from the search party; one room for now |
| Hotelbeds `clientReference` (1-20, required) | from our checkout id (idempotency, see CHECKOUT-VALIDATION.md) |
| Transfers `transferDetails` | type FLIGHT, direction ARRIVAL/DEPARTURE, `code` = flight number (max 7) of the booked outbound/return flight |
| Transfers `holder.name/surname` | traveller 1 |

## Not collected (not needed with our setup)

- Hotelbeds `paymentData` (card, billing address, 3DS, device): only for client accounts set up to pay
  by the end user's card; we pay suppliers ourselves.
- Duffel `payments`: our money, not the customer's card; `type: hold` orders omit it.
- Duffel loyalty programme accounts, Hotelbeds `voucher`, Transfers `welcomeMessage`: optional, later.

## Personal data rules (web)

- Held in the browser's memory only while on the checkout page; never in localStorage, cookies, URLs,
  sealed refs or logs. The form is not a `<form>` so nothing can be submitted as a GET.
- The pay action validates and drops the data. It is sent to the API only by the future booking call.
