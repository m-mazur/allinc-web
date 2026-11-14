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
  defaultOrigin: "STO",
};
