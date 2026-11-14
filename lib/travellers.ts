// What the suppliers need to book, and the rules for it. Used by the checkout form (instant
// feedback) and again by the pay action on the server (the check that counts). No server-only
// imports: this file ships to the browser, so it must hold rules only, never data.
//
// Sources (read 2026-11-14), summarised in docs/BOOKING-DATA.md:
// - Duffel POST /air/orders, per passenger: title, gender m|f, given_name, family_name, born_on,
//   email, phone_number (E.164); identity_documents (passport: number, issuing country, expiry)
//   only when the offer has passenger_identity_documents_required. Names: letters from Latin
//   (ASCII, Latin-1, Latin Extended-A) plus space, - and '; given + family at most 40 characters.
// - Hotelbeds POST /hotel-api/1.0/bookings: holder name + surname (1-50), per pax type AD|CH,
//   age (children; must equal the search), name, surname; remark to the hotel (<= 2000).
// - Hotelbeds Transfers POST /transfer-api/1.0/bookings: holder name, surname, email, phone (E.164);
//   flight number per direction (taken from the booked flight, not asked).

export type Gender = "m" | "f";

export type TravellerInput = {
  gender: Gender | "";
  givenName: string;
  familyName: string;
  bornOn: string; // yyyy-mm-dd
  passportNumber?: string;
  passportCountry?: string; // ISO 3166-1 alpha-2
  passportExpires?: string; // yyyy-mm-dd
};

export type BookingInput = {
  travellers: TravellerInput[]; // adults first, then children in search order
  email: string;
  phone: string; // E.164, e.g. +46701234567
  remark: string; // optional, to the hotel
};

/** Who travels, from the search: the ages the prices were fetched for. */
export type Party = { adults: number; childAges: number[]; depart: string; returnDate: string; passportRequired: boolean };

export type Errors = Record<string, string>; // field path -> Swedish message

// Latin letters (ASCII, Latin-1 Supplement, Latin Extended-A) minus the ones Duffel rejects, plus space - '
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ſ' -]+$/;
const DUFFEL_REJECTS = /[ÆæĲĳŒœÞð]/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const E164_RE = /^\+[1-9]\d{6,14}$/;
const PASSPORT_RE = /^[A-Z0-9]{5,20}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Age in whole years on a given day. */
export function ageOn(bornOn: string, day: string): number {
  const [by, bm, bd] = bornOn.split("-").map(Number);
  const [y, m, d] = day.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** "070-123 45 67" or "0046 70..." -> "+46701234567". Swedish numbers without a country code get +46. */
export function normalisePhone(raw: string): string {
  let p = raw.replace(/[\s().-]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  else if (p.startsWith("0")) p = "+46" + p.slice(1);
  return p;
}

export const tidyName = (s: string) => s.trim().replace(/\s+/g, " ");

function checkName(v: string, path: string, e: Errors) {
  const n = tidyName(v);
  if (n.length < 2) e[path] = "Minst två bokstäver.";
  else if (n.length > 50) e[path] = "Högst 50 tecken.";
  else if (!NAME_RE.test(n) || DUFFEL_REJECTS.test(n)) e[path] = "Bara bokstäver, mellanslag, bindestreck och apostrof. Skriv som i passet.";
}

export function travellerLabel(i: number, party: Pick<Party, "adults" | "childAges">): string {
  return i < party.adults ? `Vuxen ${i + 1}` : `Barn ${i - party.adults + 1} (${party.childAges[i - party.adults]} år vid hemresan)`;
}

export function validateBooking(input: BookingInput, party: Party): Errors {
  const e: Errors = {};
  const count = party.adults + party.childAges.length;
  if (!Array.isArray(input.travellers) || input.travellers.length !== count) {
    e.form = "Fyll i alla resenärer.";
    return e;
  }
  const today = new Date().toISOString().slice(0, 10);

  input.travellers.forEach((t, i) => {
    const p = `t${i}`;
    if (t.gender !== "m" && t.gender !== "f") e[`${p}.gender`] = "Välj kön som i passet.";
    checkName(t.givenName ?? "", `${p}.givenName`, e);
    checkName(t.familyName ?? "", `${p}.familyName`, e);
    if (!e[`${p}.givenName`] && !e[`${p}.familyName`] && tidyName(t.givenName).length + tidyName(t.familyName).length > 40)
      e[`${p}.familyName`] = "För- och efternamn får vara högst 40 tecken tillsammans (flygbolagets gräns).";

    if (!DATE_RE.test(t.bornOn ?? "") || Number.isNaN(Date.parse(t.bornOn)) || t.bornOn > today) e[`${p}.bornOn`] = "Ange födelsedatum.";
    else if (i < party.adults) {
      if (ageOn(t.bornOn, party.depart) < 18) e[`${p}.bornOn`] = "En vuxen ska vara minst 18 år vid avresan. Ändra sökningen om det är ett barn.";
      else if (ageOn(t.bornOn, party.depart) > 120) e[`${p}.bornOn`] = "Kontrollera födelsedatumet.";
    } else {
      // Prices were fetched for this exact age; the hotel and flight cannot change it afterwards.
      const want = party.childAges[i - party.adults];
      if (ageOn(t.bornOn, party.returnDate) !== want)
        e[`${p}.bornOn`] = `Barnet ska vara ${want} år vid hemresan, som i sökningen. Gör om sökningen om åldern är fel.`;
    }

    if (party.passportRequired) {
      const num = (t.passportNumber ?? "").replace(/\s/g, "").toUpperCase();
      if (!PASSPORT_RE.test(num)) e[`${p}.passportNumber`] = "Ange passnumret.";
      if (!COUNTRY_RE.test((t.passportCountry ?? "").toUpperCase())) e[`${p}.passportCountry`] = "Välj land som utfärdat passet.";
      if (!DATE_RE.test(t.passportExpires ?? "")) e[`${p}.passportExpires`] = "Ange passets giltighetsdatum.";
      else if (t.passportExpires! <= party.returnDate) e[`${p}.passportExpires`] = "Passet måste gälla efter hemresan.";
    }
  });

  if (!EMAIL_RE.test((input.email ?? "").trim()) || input.email.length > 254) e.email = "Ange en giltig e-postadress.";
  if (!E164_RE.test(normalisePhone(input.phone ?? ""))) e.phone = "Ange mobilnummer, gärna med landsnummer (+46…).";
  if ((input.remark ?? "").length > 500) e.remark = "Högst 500 tecken.";
  return e;
}

export const COUNTRIES: [string, string][] = [
  ["SE", "Sverige"], ["NO", "Norge"], ["DK", "Danmark"], ["FI", "Finland"], ["DE", "Tyskland"],
  ["GB", "Storbritannien"], ["PL", "Polen"], ["NL", "Nederländerna"], ["FR", "Frankrike"], ["ES", "Spanien"],
  ["IT", "Italien"], ["US", "USA"], ["IQ", "Irak"], ["SY", "Syrien"], ["IR", "Iran"], ["TR", "Turkiet"],
  ["SO", "Somalia"], ["EE", "Estland"], ["LV", "Lettland"], ["LT", "Litauen"], ["IS", "Island"],
];
