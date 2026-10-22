export const SESSION_COOKIE = "__Host-bw_session";
export const OIDC_COOKIE = "__Host-bw_oidc";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const OIDC_MAX_AGE = 60 * 10;

export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

function serialize(name: string, value: string, maxAge: number): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

export function sessionCookie(token: string): string {
  return serialize(SESSION_COOKIE, token, SESSION_MAX_AGE);
}

export function clearSessionCookie(): string {
  return serialize(SESSION_COOKIE, "", 0);
}

export function oidcCookie(token: string): string {
  return serialize(OIDC_COOKIE, token, OIDC_MAX_AGE);
}

export function clearOidcCookie(): string {
  return serialize(OIDC_COOKIE, "", 0);
}
