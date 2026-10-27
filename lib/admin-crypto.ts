// Pure credential/session helpers for the admin console. No Next.js
// imports here, so these functions are unit-testable in plain Node.
// The admin session is NOT a Supabase session: it is an HMAC-signed
// cookie (expiry + signature), verified server-side on every admin
// request. No admin credential is ever stored in plaintext — the
// database row (admin_settings) holds scrypt hashes only, and the
// initial credentials come from environment variables, never code.
import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";

const HASH_FORMAT = "scrypt";

export function hashSecret(value: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value, salt, 64).toString("hex");
  return `${HASH_FORMAT}:${salt}:${hash}`;
}

export function verifyHashedSecret(value: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== HASH_FORMAT) return false;
  const [, salt, expected] = parts;
  try {
    const actual = scryptSync(value, salt, 64).toString("hex");
    return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Constant-time comparison for two plaintext secrets (env values). */
export function secretsEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function createSessionToken(secret: string, now = Date.now()): string {
  const exp = now + ADMIN_SESSION_TTL_MS;
  const sig = createHmac("sha256", secret)
    .update(`vv-admin:${exp}`)
    .digest("hex");
  return `${exp}.${sig}`;
}

export function verifySessionToken(
  secret: string,
  token: string,
  now = Date.now()
): boolean {
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!expStr || !sig || !Number.isFinite(exp) || exp <= now) return false;
  const expected = createHmac("sha256", secret)
    .update(`vv-admin:${exp}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** One-time temporary password, shown once to the admin, never stored. */
export function generateTempPassword(): string {
  return randomBytes(18).toString("base64url");
}
