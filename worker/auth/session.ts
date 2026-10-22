import { jwtVerify, SignJWT } from "jose";

export interface SessionClaims {
  email: string;
}

export interface OidcTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function issueSession(secret: string, email: string): Promise<string> {
  return new SignJWT({ email: email.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key(secret));
}

export async function readSession(secret: string, token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (typeof payload.email !== "string" || payload.email.length === 0) return null;
    return { email: payload.email.toLowerCase() };
  } catch {
    return null;
  }
}

export async function issueOidcTransaction(secret: string, transaction: OidcTransaction): Promise<string> {
  return new SignJWT({ ...transaction })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key(secret));
}

export async function readOidcTransaction(secret: string, token: string): Promise<OidcTransaction | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (
      typeof payload.state !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.codeVerifier !== "string" ||
      typeof payload.returnTo !== "string"
    ) {
      return null;
    }
    return {
      state: payload.state,
      nonce: payload.nonce,
      codeVerifier: payload.codeVerifier,
      returnTo: payload.returnTo,
    };
  } catch {
    return null;
  }
}
