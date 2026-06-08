import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal stateless, dependency-free signed token used to authenticate Socket.io
 * connections. The HTTP layer (which has the Auth.js session) issues one of
 * these; the socket server verifies it on the handshake. Format:
 *   base64url(JSON payload).base64url(HMAC-SHA256)
 */
interface TokenPayload {
  userId: string;
  username: string;
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function issueSocketToken(
  payload: Omit<TokenPayload, "exp">,
  secret: string,
  ttlSeconds = 60 * 60,
): string {
  const full: TokenPayload = { ...payload, exp: Date.now() + ttlSeconds * 1000 };
  const body = b64url(JSON.stringify(full));
  return `${body}.${sign(body, secret)}`;
}

export function verifySocketToken(
  token: string,
  secret: string,
): { userId: string; username: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = sign(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (Date.now() > payload.exp) return null;
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}
