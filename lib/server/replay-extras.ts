import "server-only";
import type { ExtraChoice, RawExtras, RawFlight } from "./api";

// REPLAY ONLY: extra bags and seat maps made up for the recorded offer's flight, in the shape the API's
// GET /checkout/{id}/extras answers (../allinc/backend/docs/CHECKOUT-VALIDATION.md "Flight extras"). No API,
// no supplier. Bags 349 kr out / 399 kr home per traveller; seats: row 1 179 kr, rows 2-6 99 kr, row 7 free,
// a few taken. ALLINC_REPLAY_EXTRAS=none answers "this airline sells no extras"; =gone makes row 1 sell out the
// first time a row-1 seat is chosen (the PUT answers ExtrasUnavailable), to try the "choose again" flow.

export function syntheticExtras(checkoutId: string, flight: RawFlight | undefined, adults: number, childAges: number[], selected: ExtraChoice[], none: boolean, row1Gone = false): RawExtras {
  const currency = flight?.price.currency ?? "SEK";
  const passengers = [
    ...Array.from({ length: adults }, (_, i) => ({ index: i, type: "Adult" as const, age: null, seat: true })),
    ...childAges.map((age, i) => ({ index: adults + i, type: "Child" as const, age, seat: age >= 2 })),
  ];
  const journeys = (flight?.journeys ?? []).map((j, i) => ({ index: i, origin: j.origin.code, destination: j.destination.code, departsLocal: j.segments[0]?.departsLocal ?? "" }));
  if (none || !flight) return { checkoutId, currency, available: false, passengers, journeys, bags: [], seatMaps: [], selected };

  const money = (amount: number) => ({ amount, currency });
  const bags = passengers.flatMap((p) =>
    journeys.map((j) => ({ id: `xbag${p.index}j${j.index}`, passenger: p.index, journeys: [j.index], kind: "checked", maxWeightKg: 23, maxQuantity: p.index === 0 ? 2 : 1, price: money(j.index === 0 ? 349 : 399) })),
  );
  const seated = passengers.filter((p) => p.seat);
  const seatMaps = flight.journeys.flatMap((j, ji) =>
    j.segments.map((g, gi) => ({
      journey: ji,
      flightNumber: g.flightNumber,
      departsLocal: g.departsLocal,
      origin: g.origin.code,
      destination: g.destination.code,
      cabins: [
        {
          cabinClass: "economy",
          rows: [1, 2, 3, 4, 5, 6, 7].map((row) =>
            row === 4
              ? [[{ type: "exit_row", designator: null, disclosures: [], prices: [] }], [{ type: "exit_row", designator: null, disclosures: [], prices: [] }]]
              : ["ABC", "DEF"].map((letters) =>
                  [...letters].map((l) => {
                    const designator = `${row}${l}`;
                    const taken = (row * 7 + l.charCodeAt(0) + gi * 3 + ji) % 4 === 0 || (row1Gone && row === 1);
                    const price = row === 1 ? 179 : row === 7 ? 0 : 99;
                    return {
                      type: "seat",
                      designator,
                      disclosures: row === 5 && (l === "A" || l === "F") ? ["Nödutgång: bara för resenärer som kan hjälpa till vid en evakuering."] : [],
                      prices: taken ? [] : seated.map((p) => ({ id: `xs${ji}${gi}${designator}p${p.index}`, passenger: p.index, price: money(price) })),
                    };
                  }),
                ),
          ),
        },
      ],
    })),
  );
  return { checkoutId, currency, available: true, passengers, journeys, bags, seatMaps, selected };
}
