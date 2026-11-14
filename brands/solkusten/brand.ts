import type { Brand } from "../index";

// A made-up second brand that proves white labelling end to end: same pages, other host,
// colours, fonts, logo and default airport. Open http://solkusten.localhost:3000 in dev.
export const solkusten: Brand = {
  id: "solkusten",
  name: "Solkusten",
  hosts: ["solkusten.localhost"],
  market: "SE",
  locale: "sv-SE",
  logo: { src: "/brands/solkusten/logo.svg", width: 520, height: 120, alt: "Solkusten" },
  tagline: "Paketresor till solen, från din närmaste flygplats.",
  contact: { email: "kundservice@solkusten.example" },
  defaultOrigin: "GOT",
};
