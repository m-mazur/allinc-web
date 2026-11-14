import type { Brand } from "../index";

export const allinc: Brand = {
  id: "allinc",
  name: "Allinc",
  hosts: ["allinc.se", "www.allinc.se", "localhost", "127.0.0.1", "allinc.localhost"],
  market: "SE",
  locale: "sv-SE",
  logo: { src: "/brands/allinc/logo.svg", width: 668, height: 164, alt: "Allinc" },
  logoOnDark: { src: "/brands/allinc/logo-white.svg", width: 668, height: 164 },
  tagline: "Flyg och hotell i ett paket, till ett pris.",
  contact: { email: "hej@allinc.se" },
  // Stock media: sources and licences in docs/MEDIA-SOURCES.md.
  hero: { video: "/media/hero/resort-beach.mp4", poster: "/media/hero/resort-beach.jpg", posterSmall: "/media/hero/resort-beach-768.jpg" },
  featured: [
    { id: "es.tenerife", label: "Teneriffa", tag: "Vintersol", image: "/media/destinations/tenerife.jpg" },
    { id: "es.mallorca", label: "Mallorca", tag: "Ö-favorit", image: "/media/destinations/mallorca.jpg" },
    { id: "es.barcelona", label: "Barcelona", tag: "Storstad vid havet", image: "/media/destinations/barcelona.jpg" },
    { id: "gr.crete", label: "Kreta", tag: "Familjefavorit", image: "/media/destinations/crete.jpg" },
    { id: "pt.algarve", label: "Algarve", tag: "Strand och golf", image: "/media/destinations/algarve.jpg" },
    { id: "tr.antalya", label: "Antalya", tag: "All inclusive", image: "/media/destinations/antalya.jpg" },
  ],
  defaultOrigin: "STO",
};
