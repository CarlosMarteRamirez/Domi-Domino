import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Human-friendly room code, e.g. "abc123"-style but uppercase and unambiguous. */
export function generateRoomCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function generateToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
