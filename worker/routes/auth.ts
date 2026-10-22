import type { Hono } from "hono";
import { buildAuthorizationUrl, exchangeCode, verifyIdToken } from "../auth/oidc";
import { issueOidcTransaction, issueSession, readOidcTransaction } from "../auth/session";
import { resolveRole } from "../auth/authz";
import {
  clearOidcCookie,
  clearSessionCookie,
  oidcCookie,
  readCookie,
  sessionCookie,
  OIDC_COOKIE,
} from "../lib/cookies";
import { logEvent, loginErrorPage } from "../lib/http";
import { sanitizeReturnTo } from "../lib/returnTo";
import { codeChallengeS256, randomToken, safeEqual } from "../lib/security";
import type { AppEnv, AppDeps } from "../app-env";

export function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

export function devBypassActive(env: Env, url: URL): boolean {
  return env.DEV_AUTH_BYPASS === "true" && isLocalHost(url.hostname);
}

export function registerAuthRoutes(app: Hono<AppEnv>, deps: AppDeps): void {
  app.get("/auth/login", async (c) => {
    const url = new URL(c.req.url);
    const returnTo = sanitizeReturnTo(c.req.query("returnTo"));

    if (devBypassActive(c.env, url)) {
      const email = (c.env.DEV_USER_EMAIL || c.env.ADMIN_EMAIL).toLowerCase();
      const token = await issueSession(c.env.SESSION_SECRET, email);
      c.header("Set-Cookie", sessionCookie(token));
      c.header("Cache-Control", "no-store");
      logEvent("auth.dev_bypass", { host: url.hostname });
      return c.redirect(returnTo);
    }

    const state = randomToken();
    const nonce = randomToken();
    const codeVerifier = randomToken();
    const codeChallenge = await codeChallengeS256(codeVerifier);
    const transaction = await issueOidcTransaction(c.env.SESSION_SECRET, {
      state,
      nonce,
      codeVerifier,
      returnTo,
    });
    const redirectUri = `${url.origin}/auth/callback`;
    const authorization = buildAuthorizationUrl({
      issuer: c.env.OIDC_ISSUER,
      clientId: c.env.OIDC_CLIENT_ID,
      redirectUri,
      state,
      nonce,
      codeChallenge,
    });
    c.header("Set-Cookie", oidcCookie(transaction));
    c.header("Cache-Control", "no-store");
    return c.redirect(authorization);
  });

  app.get("/auth/callback", async (c) => {
    const url = new URL(c.req.url);
    const state = c.req.query("state");
    const code = c.req.query("code");
    const cookie = readCookie(c.req.header("cookie"), OIDC_COOKIE);
    if (!state || !code || !cookie) return loginErrorPage(c);

    const pending = await readOidcTransaction(c.env.SESSION_SECRET, cookie);
    if (!pending || !safeEqual(pending.state, state)) return loginErrorPage(c);

    try {
      const idToken = await exchangeCode({
        issuer: c.env.OIDC_ISSUER,
        clientId: c.env.OIDC_CLIENT_ID,
        clientSecret: c.env.OIDC_CLIENT_SECRET,
        code,
        codeVerifier: pending.codeVerifier,
        redirectUri: `${url.origin}/auth/callback`,
        fetchImpl: deps.fetch,
      });
      const email = await verifyIdToken({
        issuer: c.env.OIDC_ISSUER,
        clientId: c.env.OIDC_CLIENT_ID,
        idToken,
        nonce: pending.nonce,
        fetchImpl: deps.fetch,
      });
      const role = await resolveRole(c.env, email);
      if (!role) {
        c.header("Set-Cookie", clearOidcCookie());
        c.header("Cache-Control", "no-store");
        logEvent("auth.denied");
        return c.redirect("/?login=denied");
      }
      const session = await issueSession(c.env.SESSION_SECRET, email);
      c.header("Set-Cookie", sessionCookie(session), { append: true });
      c.header("Set-Cookie", clearOidcCookie(), { append: true });
      c.header("Cache-Control", "no-store");
      logEvent("auth.session_issued", { role });
      return c.redirect(sanitizeReturnTo(pending.returnTo));
    } catch (error) {
      logEvent("auth.callback_failed", {
        error: error instanceof Error ? error.message : String(error),
      }, "error");
      c.header("Set-Cookie", clearOidcCookie());
      return loginErrorPage(c);
    }
  });

  app.post("/auth/logout", (c) => {
    c.header("Set-Cookie", clearSessionCookie());
    c.header("Cache-Control", "no-store");
    logEvent("auth.logout");
    return c.redirect("/");
  });
}
