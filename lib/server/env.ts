import "server-only";
import { createHash } from "node:crypto";

// Server-only settings. Nothing here may be prefixed NEXT_PUBLIC_: that would ship it to the browser.

const isProd = process.env.NODE_ENV === "production";

function sealKey(): Buffer {
  const raw = process.env.WEB_SEAL_KEY;
  if (raw && raw.length >= 32) return createHash("sha256").update(raw).digest();
  if (isProd && process.env.ALLINC_API_MODE !== "replay")
    throw new Error("WEB_SEAL_KEY is required in production (32+ random characters).");
  // Dev only: a fixed key so links survive restarts. Never used in production.
  return createHash("sha256").update("allinc-web dev key, not secret").digest();
}

export const env = {
  /** Base URL of allinc-api, reached over the private network only. */
  apiUrl: (process.env.ALLINC_API_URL ?? "http://localhost:8080").replace(/\/$/, ""),
  /**
   * live: call the API. record: call it and save each response under dev/fixtures.
   * replay: answer from dev/fixtures without touching the API (no supplier quota spent).
   */
  apiMode: (process.env.ALLINC_API_MODE ?? "live") as "live" | "record" | "replay",
  fixturesDir: process.env.ALLINC_FIXTURES_DIR ?? `${process.cwd()}/dev/fixtures`,
  /** Hotel texts language. "en" until Swedish content is fetched (each language is its own supplier call). */
  contentLanguage: process.env.CONTENT_LANGUAGE ?? "en",
  /** Shared secret for the API's /checkout routes (API setting Checkout:WebKey). Required in production. */
  webKey: process.env.ALLINC_WEB_KEY ?? "",
  get sealKey() {
    return sealKey();
  },
};
