import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/** URL-safe random token for recipient portal links. */
export function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Hash an optional share passcode as scrypt with a per-passcode salt. */
export function hashPasscode(passcode: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(passcode, salt, 32);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Constant-time verification of a passcode against a stored hash. */
export function verifyPasscode(passcode: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = scryptSync(passcode, salt, 32);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
