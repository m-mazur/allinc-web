"use client";

import { COUNTRIES, travellerLabel, validateBooking, type TravellerInput } from "@/lib/travellers";
import { cn } from "@/lib/cn";
import { useCheckout } from "./checkout-state";

// Traveller details the suppliers need to book (see lib/travellers.ts and docs/BOOKING-DATA.md).
// Not a <form>: a plain submit would put personal data in the URL. Values live in client state
// only and are sent with "Till betalning". Errors show after leaving a field or after pay.

type Props = { adults: number; childAges: number[]; depart: string; returnDate: string; passportRequired: boolean };

const input =
  "mt-1 h-11 w-full rounded-control border bg-surface px-3 text-base text-ink focus:border-primary focus:outline-2 focus:outline-primary/30";

export function TravellerForm({ adults, childAges, depart, returnDate, passportRequired }: Props) {
  const { booking, setBooking, errors, setErrors } = useCheckout();
  const party = { adults, childAges, depart, returnDate, passportRequired };

  const setT = (i: number, patch: Partial<TravellerInput>) =>
    setBooking({ ...booking, travellers: booking.travellers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  /** Re-check one field when the customer leaves it, keeping other errors as they are. */
  const touch = (path: string) => {
    const all = validateBooking(booking, party);
    const next = { ...errors };
    if (all[path]) next[path] = all[path];
    else delete next[path];
    setErrors(next);
  };

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="travellers-h">
      <h2 id="travellers-h" className="text-lg">
        Resenärer
      </h2>
      <p className="text-sm text-muted">Skriv namnen exakt som i passet. Uppgifterna går till flygbolaget och hotellet när du bokar.</p>
      {errors.form && <p className="mt-2 text-sm text-danger">{errors.form}</p>}

      <div className="mt-4 space-y-6">
        {booking.travellers.map((t, i) => (
          <fieldset key={i} className="space-y-3 border-t border-line pt-4 first:border-0 first:pt-0">
            <legend className="mb-1 text-sm font-bold">
              {travellerLabel(i, party)}
              {i === 0 && <span className="font-normal text-muted"> · huvudresenär</span>}
            </legend>
            <div className="grid gap-3 sm:grid-cols-[150px_1fr_1fr]">
              <Field label="Kön (som i passet)" path={`t${i}.gender`} error={errors[`t${i}.gender`]}>
                {(id, invalid) => (
                  <select
                    id={id}
                    value={t.gender}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? `${id}-err` : undefined}
                    onChange={(e) => setT(i, { gender: e.target.value as TravellerInput["gender"] })}
                    onBlur={() => touch(`t${i}.gender`)}
                    className={cn(input, invalid ? "border-danger" : "border-line")}
                  >
                    <option value="">Välj</option>
                    <option value="f">Kvinna</option>
                    <option value="m">Man</option>
                  </select>
                )}
              </Field>
              <Field label="Förnamn" path={`t${i}.givenName`} error={errors[`t${i}.givenName`]}>
                {(id, invalid) => (
                  <input
                    id={id}
                    value={t.givenName}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? `${id}-err` : undefined}
                    autoComplete={i === 0 ? "given-name" : "off"}
                    onChange={(e) => setT(i, { givenName: e.target.value })}
                    onBlur={() => touch(`t${i}.givenName`)}
                    className={cn(input, invalid ? "border-danger" : "border-line")}
                  />
                )}
              </Field>
              <Field label="Efternamn" path={`t${i}.familyName`} error={errors[`t${i}.familyName`]}>
                {(id, invalid) => (
                  <input
                    id={id}
                    value={t.familyName}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? `${id}-err` : undefined}
                    autoComplete={i === 0 ? "family-name" : "off"}
                    onChange={(e) => setT(i, { familyName: e.target.value })}
                    onBlur={() => touch(`t${i}.familyName`)}
                    className={cn(input, invalid ? "border-danger" : "border-line")}
                  />
                )}
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Födelsedatum" path={`t${i}.bornOn`} error={errors[`t${i}.bornOn`]}>
                {(id, invalid) => (
                  <input
                    id={id}
                    type="date"
                    value={t.bornOn}
                    max={depart}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? `${id}-err` : undefined}
                    autoComplete={i === 0 ? "bday" : "off"}
                    onChange={(e) => setT(i, { bornOn: e.target.value })}
                    onBlur={() => touch(`t${i}.bornOn`)}
                    className={cn(input, invalid ? "border-danger" : "border-line")}
                  />
                )}
              </Field>
            </div>
            {passportRequired && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Passnummer" path={`t${i}.passportNumber`} error={errors[`t${i}.passportNumber`]}>
                  {(id, invalid) => (
                    <input
                      id={id}
                      value={t.passportNumber ?? ""}
                      aria-invalid={invalid}
                    aria-describedby={invalid ? `${id}-err` : undefined}
                      autoComplete="off"
                      onChange={(e) => setT(i, { passportNumber: e.target.value.toUpperCase() })}
                      onBlur={() => touch(`t${i}.passportNumber`)}
                      className={cn(input, invalid ? "border-danger" : "border-line")}
                    />
                  )}
                </Field>
                <Field label="Utfärdat av" path={`t${i}.passportCountry`} error={errors[`t${i}.passportCountry`]}>
                  {(id, invalid) => (
                    <select
                      id={id}
                      value={t.passportCountry ?? "SE"}
                      aria-invalid={invalid}
                    aria-describedby={invalid ? `${id}-err` : undefined}
                      onChange={(e) => setT(i, { passportCountry: e.target.value })}
                      onBlur={() => touch(`t${i}.passportCountry`)}
                      className={cn(input, invalid ? "border-danger" : "border-line")}
                    >
                      {COUNTRIES.map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Giltigt till" path={`t${i}.passportExpires`} error={errors[`t${i}.passportExpires`]}>
                  {(id, invalid) => (
                    <input
                      id={id}
                      type="date"
                      value={t.passportExpires ?? ""}
                      min={returnDate}
                      aria-invalid={invalid}
                    aria-describedby={invalid ? `${id}-err` : undefined}
                      onChange={(e) => setT(i, { passportExpires: e.target.value })}
                      onBlur={() => touch(`t${i}.passportExpires`)}
                      className={cn(input, invalid ? "border-danger" : "border-line")}
                    />
                  )}
                </Field>
              </div>
            )}
          </fieldset>
        ))}

        <fieldset className="space-y-3 border-t border-line pt-4">
          <legend className="mb-1 text-sm font-bold">Kontaktuppgifter</legend>
          <p className="text-xs text-muted">Bokningsbekräftelsen skickas hit. Flygbolaget och transferbolaget kan behöva nå dig under resan.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="E-post" path="email" error={errors.email}>
              {(id, invalid) => (
                <input
                  id={id}
                  type="email"
                  value={booking.email}
                  aria-invalid={invalid}
                    aria-describedby={invalid ? `${id}-err` : undefined}
                  autoComplete="email"
                  onChange={(e) => setBooking({ ...booking, email: e.target.value })}
                  onBlur={() => touch("email")}
                  className={cn(input, invalid ? "border-danger" : "border-line")}
                />
              )}
            </Field>
            <Field label="Mobilnummer" path="phone" error={errors.phone}>
              {(id, invalid) => (
                <input
                  id={id}
                  type="tel"
                  value={booking.phone}
                  placeholder="+46 70 123 45 67"
                  aria-invalid={invalid}
                    aria-describedby={invalid ? `${id}-err` : undefined}
                  autoComplete="tel"
                  onChange={(e) => setBooking({ ...booking, phone: e.target.value })}
                  onBlur={() => touch("phone")}
                  className={cn(input, invalid ? "border-danger" : "border-line")}
                />
              )}
            </Field>
          </div>
          <Field label="Önskemål till hotellet (valfritt)" path="remark" error={errors.remark}>
            {(id, invalid) => (
              <textarea
                id={id}
                value={booking.remark}
                maxLength={500}
                rows={2}
                aria-invalid={invalid}
                    aria-describedby={invalid ? `${id}-err` : undefined}
                placeholder="Till exempel sen ankomst eller önskemål om sängar. Hotellet gör sitt bästa men kan inte lova."
                onChange={(e) => setBooking({ ...booking, remark: e.target.value })}
                className={cn(input, "h-auto py-2", invalid ? "border-danger" : "border-line")}
              />
            )}
          </Field>
        </fieldset>
      </div>
    </section>
  );
}

function Field({ label, path, error, children }: { label: string; path: string; error?: string; children: (id: string, invalid: boolean) => React.ReactNode }) {
  const id = `f-${path}`;
  const errId = `${id}-err`;
  return (
    <div>
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      {children(id, !!error)}
      {error && (
        <p id={errId} className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
