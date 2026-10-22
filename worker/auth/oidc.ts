import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { safeEqual } from "../lib/security";

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export interface AuthorizationParams {
  issuer: string;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}

export function issuerUrl(issuer: string, path: string): string {
  return `${issuer.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function buildAuthorizationUrl(params: AuthorizationParams): string {
  const url = new URL(issuerUrl(params.issuer, "authorization"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeCode(options: {
  issuer: string;
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: options.code,
    client_id: options.clientId,
    client_secret: options.clientSecret,
    code_verifier: options.codeVerifier,
    redirect_uri: options.redirectUri,
  });
  const response = await fetchImpl(issuerUrl(options.issuer, "token"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error(`OIDC token exchange failed (${response.status})`);
  }
  const payload = await response.json() as { id_token?: unknown };
  if (typeof payload.id_token !== "string" || payload.id_token.length === 0) {
    throw new Error("OIDC token response did not include an id_token");
  }
  return payload.id_token;
}

function jwks(issuer: string, fetchImpl: typeof fetch): ReturnType<typeof createRemoteJWKSet> {
  const cached = jwksByIssuer.get(issuer);
  if (cached) return cached;
  const set = createRemoteJWKSet(new URL(issuerUrl(issuer, "jwks")), {
    [customFetch]: (url, options) => fetchImpl(url, options),
  });
  jwksByIssuer.set(issuer, set);
  return set;
}

/** Test helper. The production cache lives for the isolate. */
export function clearJwksCache(): void {
  jwksByIssuer.clear();
}

export async function verifyIdToken(options: {
  issuer: string;
  clientId: string;
  idToken: string;
  nonce: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const { payload } = await jwtVerify(options.idToken, jwks(options.issuer, fetchImpl), {
    issuer: options.issuer,
    audience: options.clientId,
    algorithms: ["RS256"],
  });
  if (typeof payload.nonce !== "string" || !safeEqual(payload.nonce, options.nonce)) {
    throw new Error("OIDC nonce mismatch");
  }
  if (typeof payload.email !== "string" || payload.email.length === 0) {
    throw new Error("OIDC id_token is missing email");
  }
  return payload.email.toLowerCase();
}
