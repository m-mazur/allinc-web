import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { env } from "./env";

// Sealed references. Anything the browser must carry back to us but must not read (supplier
// booking tokens, hotel keys that name the supplier, image URLs on supplier hosts) is encrypted
// and authenticated with AES-256-GCM. The browser sees an opaque string; a changed byte fails.

const b64u = (b: Buffer) => b.toString("base64url");

function encrypt(plain: Buffer, iv: Buffer, aad: string): string {
  const c = createCipheriv("aes-256-gcm", env.sealKey, iv);
  c.setAAD(Buffer.from(aad));
  const body = Buffer.concat([c.update(plain), c.final()]);
  return b64u(Buffer.concat([iv, c.getAuthTag(), body]));
}

function decrypt(token: string, aad: string): Buffer | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29) return null;
    const d = createDecipheriv("aes-256-gcm", env.sealKey, raw.subarray(0, 12));
    d.setAAD(Buffer.from(aad));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
  } catch {
    return null;
  }
}

/** Seal a JSON value for one purpose. Random IV: the same value seals differently each time. */
export function seal(purpose: string, value: unknown): string {
  return encrypt(Buffer.from(JSON.stringify(value)), randomBytes(12), purpose);
}

export function unseal<T>(purpose: string, token: string): T | null {
  const plain = decrypt(token, purpose);
  if (!plain) return null;
  try {
    return JSON.parse(plain.toString()) as T;
  } catch {
    return null;
  }
}

/**
 * Deterministic seal (synthetic IV = HMAC of the value) for values whose URL should be stable,
 * so browsers and CDNs can cache them: image addresses.
 */
export function sealStable(purpose: string, value: string): string {
  const iv = createHmac("sha256", env.sealKey).update(purpose + "\0" + value).digest().subarray(0, 12);
  return encrypt(Buffer.from(value), iv, purpose);
}

export function unsealStable(purpose: string, token: string): string | null {
  return decrypt(token, purpose)?.toString() ?? null;
}
