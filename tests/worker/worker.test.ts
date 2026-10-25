import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../worker/app";
import { clearJwksCache } from "../../worker/auth/oidc";
import { issueSession } from "../../worker/auth/session";
import { readOidcTransaction } from "../../worker/auth/session";
import { OIDC_COOKIE, readCookie, SESSION_COOKIE } from "../../worker/lib/cookies";
import { MAX_AI_BODY_BYTES } from "../../worker/lib/http";

const HOST = "https://biblia-web.ezeo-cloud.workers.dev";
const ISSUER = "https://team.cloudflareaccess.com/cdn-cgi/access/sso/oidc/test-client";
const ADMIN = "ekiolivier@gmail.com";

let privateKey: CryptoKey;
let jwks: { keys: JWK[] };
let sequence = 0;

function nextEmail(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}@example.com`;
}

function call(app: ReturnType<typeof createApp>, url: string, init?: RequestInit) {
  return app.fetch(new Request(url, init), env);
}

function pathOf(response: Response): string {
  const location = response.headers.get("location") ?? "";
  if (!location) return "";
  if (location.startsWith("http")) {
    const url = new URL(location);
    return `${url.pathname}${url.search}`;
  }
  return location;
}

function cookieHeader(response: Response, name: string): string | null {
  const line = response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${name}=`));
  return line ? line.split(";")[0] : null;
}

async function sessionCookie(email: string): Promise<string> {
  const token = await issueSession(env.SESSION_SECRET, email);
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}`;
}

async function allow(email: string, enabled = true) {
  await env.DB.prepare(
    "INSERT INTO allowed_emails (email, enabled, added_by) VALUES (?, ?, ?)",
  ).bind(email, enabled ? 1 : 0, ADMIN).run();
}

function sameOriginHeaders(url: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("origin", new URL(url).origin);
  headers.set("sec-fetch-site", "same-origin");
  return headers;
}

async function signIdToken(claims: { email: string; nonce: string; audience?: string; issuer?: string; expired?: boolean }) {
  const jwt = new SignJWT({ email: claims.email, nonce: claims.nonce })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(claims.issuer ?? ISSUER)
    .setAudience(claims.audience ?? "test-client")
    .setIssuedAt()
    .setExpirationTime(claims.expired ? "-1m" : "5m");
  return jwt.sign(privateKey);
}

function oidcFetch(idToken: string): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.endsWith("/token")) return Response.json({ id_token: idToken });
    if (url.endsWith("/jwks")) return Response.json(jwks);
    return new Response("not found", { status: 404 });
  };
}

async function beginLogin(returnTo: string, host = HOST) {
  const app = createApp({ fetch: oidcFetch("pending") });
  const response = await call(app, `${host}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  const pair = cookieHeader(response, OIDC_COOKIE);
  const token = readCookie(pair, OIDC_COOKIE);
  const pending = token ? await readOidcTransaction(env.SESSION_SECRET, token) : null;
  return { app, response, pair, pending };
}

beforeAll(async () => {
  const keys = await generateKeyPair("RS256", { extractable: true });
  privateKey = keys.privateKey;
  const jwk = await exportJWK(keys.publicKey);
  jwk.kid = "test-key";
  jwk.alg = "RS256";
  jwk.use = "sig";
  jwks = { keys: [jwk] };
});

beforeEach(() => {
  clearJwksCache();
});

afterAll(() => {
  clearJwksCache();
});

describe("OIDC", () => {
  it("rejects a bad state, nonce, audience, issuer and expired token", async () => {
    const started = await beginLogin("/juan/3");
    expect(started.pending).not.toBeNull();
    const pending = started.pending!;

    const badState = await call(createApp({ fetch: oidcFetch(await signIdToken({ email: ADMIN, nonce: pending.nonce })) }),
      `${HOST}/auth/callback?code=abc&state=no`,
      { headers: { cookie: started.pair ?? "" } });
    expect(badState.status).toBe(400);
    expect(await badState.text()).toContain("No se pudo iniciar sesión, probá de nuevo.");

    const cases = [
      { email: ADMIN, nonce: "nonce-incorrecto" },
      { email: ADMIN, nonce: pending.nonce, audience: "otra-app" },
      { email: ADMIN, nonce: pending.nonce, issuer: "https://evil.example" },
      { email: ADMIN, nonce: pending.nonce, expired: true },
    ];
    for (const claims of cases) {
      clearJwksCache();
      const login = await beginLogin("/juan/3");
      const token = await signIdToken({ ...claims, nonce: claims.nonce === pending.nonce ? login.pending!.nonce : claims.nonce });
      const response = await call(createApp({ fetch: oidcFetch(token) }),
        `${HOST}/auth/callback?code=abc&state=${login.pending!.state}`,
        { headers: { cookie: login.pair ?? "" } });
      expect(response.status).toBe(400);
    }
  });

  it("sends an unknown or disabled email to login=denied", async () => {
    const disabled = nextEmail("disabled");
    await allow(disabled, false);
    for (const email of [nextEmail("unknown"), disabled]) {
      clearJwksCache();
      const login = await beginLogin("/juan/3");
      const token = await signIdToken({ email, nonce: login.pending!.nonce });
      const response = await call(createApp({ fetch: oidcFetch(token) }),
        `${HOST}/auth/callback?code=abc&state=${login.pending!.state}`,
        { headers: { cookie: login.pair ?? "" } });
      expect(pathOf(response)).toBe("/?login=denied");
      expect(cookieHeader(response, SESSION_COOKIE)).toBeNull();
    }
  });

  it("drops a malicious returnTo", async () => {
    for (const returnTo of ["//evil.com", "https://evil.com"]) {
      clearJwksCache();
      const login = await beginLogin(returnTo);
      expect(login.pending?.returnTo).toBe("/");
      const token = await signIdToken({ email: ADMIN, nonce: login.pending!.nonce });
      const response = await call(createApp({ fetch: oidcFetch(token) }),
        `${HOST}/auth/callback?code=abc&state=${login.pending!.state}`,
        { headers: { cookie: login.pair ?? "" } });
      expect(pathOf(response)).toBe("/");
      expect(cookieHeader(response, SESSION_COOKIE)).toContain(SESSION_COOKIE);
    }
  });

  it("issues a dev session only on localhost", async () => {
    const local = await call(createApp(), "http://localhost/auth/login?returnTo=/juan/3");
    expect(pathOf(local)).toBe("/juan/3");
    expect(cookieHeader(local, SESSION_COOKIE)).toContain(SESSION_COOKIE);

    const remote = await call(createApp({ fetch: oidcFetch("unused") }), `${HOST}/auth/login?returnTo=/juan/3`);
    expect(remote.headers.get("location")).toContain(ISSUER);
    expect(cookieHeader(remote, SESSION_COOKIE)).toBeNull();
    expect(cookieHeader(remote, OIDC_COOKIE)).toContain(OIDC_COOKIE);
  });
});

describe("session and roles", () => {
  it("accepts a valid session and rejects a tampered or expired cookie", async () => {
    const cookie = await sessionCookie(ADMIN);
    const me = await call(createApp(), `${HOST}/api/me`, { headers: { cookie } });
    expect(await me.json()).toMatchObject({ authenticated: true, email: ADMIN, role: "admin" });

    const tampered = await call(createApp(), `${HOST}/api/bible-ai/stream`, {
      method: "POST",
      headers: sameOriginHeaders(`${HOST}/api/bible-ai/stream`, {
        cookie: `${cookie}x`,
        "content-type": "application/json",
      }),
      body: "{}",
    });
    expect(tampered.status).toBe(401);

    const expired = await new SignJWT({ email: ADMIN })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("-1m")
      .sign(new TextEncoder().encode(env.SESSION_SECRET));
    const stale = await call(createApp(), `${HOST}/api/bible-ai/stream`, {
      method: "POST",
      headers: sameOriginHeaders(`${HOST}/api/bible-ai/stream`, {
        cookie: `${SESSION_COOKIE}=${expired}`,
        "content-type": "application/json",
      }),
      body: "{}",
    });
    expect(stale.status).toBe(401);
    expect(await stale.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("cuts AI when the email is disabled and restores it without a new login", async () => {
    const email = nextEmail("reader");
    await allow(email, true);
    const cookie = await sessionCookie(email);
    const api = { fetch: async () => new Response("data: ok\n\n", { status: 200 }) } as unknown as Fetcher;
    const url = `${HOST}/api/bible-ai/stream`;
    const send = () => call(createApp({ api }), url, {
      method: "POST",
      headers: sameOriginHeaders(url, { cookie, "content-type": "application/json" }),
      body: "{}",
    });
    expect((await send()).status).toBe(200);
    await env.DB.prepare("UPDATE allowed_emails SET enabled = 0 WHERE email = ?").bind(email).run();
    const denied = await send();
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: "NOT_ALLOWED" });
    await env.DB.prepare("UPDATE allowed_emails SET enabled = 1 WHERE email = ?").bind(email).run();
    expect((await send()).status).toBe(200);
  });

  it("keeps admin routes for the admin and rejects everyone else", async () => {
    const user = nextEmail("user");
    await allow(user, true);
    const userCookie = await sessionCookie(user);
    const forbidden = await call(createApp({ fetch: async () => new Response("no") }), `${HOST}/api/admin/allowed-emails`, {
      headers: { cookie: userCookie },
    });
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ code: "FORBIDDEN" });

    const adminCookie = await sessionCookie(ADMIN);
    const list = await call(createApp({ fetch: async () => new Response("no") }), `${HOST}/api/admin/allowed-emails`, {
      headers: { cookie: adminCookie },
    });
    expect(list.status).toBe(200);
    const payload = await list.json() as { adminEmail: string; emails: unknown[] };
    expect(payload.adminEmail).toBe(ADMIN);
    expect(payload.emails.some((row) => (row as { email: string }).email === ADMIN)).toBe(false);

    const patch = await call(createApp(), `${HOST}/api/admin/allowed-emails/${encodeURIComponent(ADMIN)}`, {
      method: "PATCH",
      headers: sameOriginHeaders(HOST, { cookie: adminCookie, "content-type": "application/json" }),
      body: JSON.stringify({ enabled: false }),
    });
    expect(patch.status).toBe(400);
    expect(await patch.json()).toMatchObject({ code: "ADMIN_EMAIL" });

    const deleted = await call(createApp(), `${HOST}/api/admin/allowed-emails/${encodeURIComponent(user)}`, {
      method: "DELETE",
      headers: sameOriginHeaders(HOST, { cookie: adminCookie }),
    });
    expect(deleted.status).toBe(404);
    expect(await deleted.json()).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("access policy sync", () => {
  it("puts only enabled emails and records every action", async () => {
    const enabled = nextEmail("enabled");
    const disabled = nextEmail("disabled");
    const added = nextEmail("added");
    await allow(enabled, true);
    await allow(disabled, false);
    const captured: { body: { include?: Array<{ email?: { email?: string } }> } | null } = { body: null };
    const fetchImpl: typeof fetch = async (_input, init) => {
      if (!init?.method || init.method === "GET") {
        return Response.json({ success: true, result: { name: "biblia-ia-whitelist", decision: "allow", include: [], exclude: [{ email: { email: "blocked@example.com" } }], require: [] } });
      }
      if (init.method === "PUT") {
        captured.body = JSON.parse(String(init.body)) as { include?: Array<{ email?: { email?: string } }> };
        return Response.json({ success: true, result: captured.body });
      }
      return new Response("no", { status: 404 });
    };
    const cookie = await sessionCookie(ADMIN);
    const headers = sameOriginHeaders(HOST, { cookie, "content-type": "application/json" });
    const add = await call(createApp({ fetch: fetchImpl }), `${HOST}/api/admin/allowed-emails`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: added }),
    });
    expect(await add.json()).toMatchObject({ saved: true, synced: true });
    const included = (captured.body?.include ?? []).map((rule) => rule.email?.email);
    expect(included).toContain(ADMIN);
    expect(included).toContain(enabled);
    expect(included).toContain(added);
    expect(included).not.toContain(disabled);

    const disable = await call(createApp({ fetch: fetchImpl }), `${HOST}/api/admin/allowed-emails/${encodeURIComponent(enabled)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ enabled: false }),
    });
    expect((await disable.json() as { synced: boolean }).synced).toBe(true);
    const enable = await call(createApp({ fetch: fetchImpl }), `${HOST}/api/admin/allowed-emails/${encodeURIComponent(enabled)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ enabled: true }),
    });
    expect((await enable.json() as { synced: boolean }).synced).toBe(true);
    await call(createApp({ fetch: fetchImpl }), `${HOST}/api/admin/sync`, { method: "POST", headers });

    const audit = await env.DB.prepare(
      "SELECT action, email FROM admin_audit WHERE email = ? OR email = ? OR (action = 'sync' AND email IS NULL) ORDER BY id",
    ).bind(added, enabled).all<{ action: string; email: string | null }>();
    const actions = audit.results.map((row) => `${row.action}:${row.email ?? ""}`);
    expect(actions).toContain(`add:${added}`);
    expect(actions).toContain(`disable:${enabled}`);
    expect(actions).toContain(`enable:${enabled}`);
    expect(actions.filter((action) => action.startsWith("sync:")).length).toBeGreaterThanOrEqual(4);
  });

  it("keeps the D1 write when Access rejects the policy", async () => {
    const email = nextEmail("unsynced");
    const fetchImpl: typeof fetch = async (_input, init) => {
      if (init?.method === "PUT") {
        return Response.json({ errors: [{ message: "policy rejected" }] }, { status: 400 });
      }
      return Response.json({ success: true, result: { name: "biblia-ia-whitelist" } });
    };
    const response = await call(createApp({ fetch: fetchImpl }), `${HOST}/api/admin/allowed-emails`, {
      method: "POST",
      headers: sameOriginHeaders(HOST, {
        cookie: await sessionCookie(ADMIN),
        "content-type": "application/json",
      }),
      body: JSON.stringify({ email }),
    });
    expect(await response.json()).toMatchObject({ saved: true, synced: false, error: "policy rejected" });
    const row = await env.DB.prepare("SELECT enabled FROM allowed_emails WHERE email = ?").bind(email).first<{ enabled: number }>();
    expect(row?.enabled).toBe(1);
  });
});

describe("AI proxy", () => {
  function apiFor(response: Response | (() => Promise<Response>), seen?: { headers?: Headers; url?: string }): Fetcher {
    return {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        if (seen) {
          seen.headers = request.headers;
          seen.url = request.url;
        }
        return typeof response === "function" ? response() : response;
      },
    } as unknown as Fetcher;
  }

  async function asUser(email: string) {
    await allow(email, true);
    return sessionCookie(email);
  }

  it("forwards a header whitelist and streams without buffering", async () => {
    const email = nextEmail("proxy");
    const cookie = await asUser(email);
    const seen: { headers?: Headers; url?: string } = {};
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode("data: first\n\n"));
        await gate;
        controller.close();
      },
    });
    const upstream = new Response(stream, {
      status: 207,
      headers: {
        "content-type": "text/event-stream",
        "x-request-id": "srv",
        "retry-after": "3",
        "set-cookie": "leak=1",
      },
    });
    const url = `${HOST}/api/bible-ai/stream`;
    const pending = call(createApp({ api: apiFor(upstream, seen) }), url, {
      method: "POST",
      headers: sameOriginHeaders(url, {
        cookie,
        authorization: "Bearer secret",
        "content-type": "application/json",
        accept: "text/event-stream",
        "x-request-id": "req-1",
        "cf-connecting-ip": "203.0.113.8",
        "x-api-key": "from-the-browser",
      }),
      body: "{}",
    });
    const response = await Promise.race([
      pending,
      new Promise<Response>((_resolve, reject) => setTimeout(() => reject(new Error("buffered")), 1000)),
    ]);
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain("first");
    release();
    await reader.read();
    expect(response.status).toBe(207);
    expect(seen.url).toBe("https://logosagent-api/api/bible-ai/stream");
    expect(seen.headers?.get("cookie")).toBeNull();
    expect(seen.headers?.get("authorization")).toBeNull();
    expect(seen.headers?.get("content-type")).toContain("application/json");
    expect(seen.headers?.get("accept")).toBe("text/event-stream");
    expect(seen.headers?.get("x-request-id")).toBe("req-1");
    expect(seen.headers?.get("cf-connecting-ip")).toBe("203.0.113.8");
    expect(seen.headers?.get("x-api-key")).toBe("test-logosagent-key");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("no-cache");
    expect(response.headers.get("cache-control")).toContain("no-transform");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("retry-after")).toBe("3");
  });

  it("passes the upstream status through", async () => {
    const cookie = await asUser(nextEmail("status"));
    const url = `${HOST}/api/bible-ai/stream`;
    const response = await call(createApp({
      api: apiFor(Response.json({ error: "no", code: "NOT_FOUND" }, { status: 404 })),
    }), url, {
      method: "POST",
      headers: sameOriginHeaders(url, { cookie, "content-type": "application/json" }),
      body: "{}",
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects the wrong content type, a huge body, another origin and a dead upstream", async () => {
    const cookie = await asUser(nextEmail("limits"));
    const url = `${HOST}/api/bible-ai/stream`;
    const wrongType = await call(createApp({ api: apiFor(new Response("no")) }), url, {
      method: "POST",
      headers: sameOriginHeaders(url, { cookie, "content-type": "text/plain" }),
      body: "{}",
    });
    expect(wrongType.status).toBe(415);

    const huge = await call(createApp({ api: apiFor(new Response("no")) }), url, {
      method: "POST",
      headers: sameOriginHeaders(url, { cookie, "content-type": "application/json" }),
      body: "x".repeat(MAX_AI_BODY_BYTES + 1),
    });
    expect(huge.status).toBe(413);

    const cross = await call(createApp(), url, {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json", cookie },
      body: "{}",
    });
    expect(cross.status).toBe(403);
    expect(await cross.json()).toMatchObject({ code: "CROSS_ORIGIN" });

    const sameSite = await call(createApp(), url, {
      method: "POST",
      headers: { "sec-fetch-site": "same-site", "content-type": "application/json", cookie },
      body: "{}",
    });
    expect(sameSite.status).toBe(403);

    const down = await call(createApp({
      api: { fetch: async () => { throw new Error("down"); } } as unknown as Fetcher,
    }), url, {
      method: "POST",
      headers: sameOriginHeaders(url, { cookie, "content-type": "application/json" }),
      body: "{}",
    });
    expect(down.status).toBe(502);
    expect(await down.json()).toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });

  it("treats an upstream 401 as a misconfigured key, not as a user error", async () => {
    const cookie = await asUser(nextEmail("upstream-401"));
    const url = `${HOST}/api/bible-ai/stream`;
    const response = await call(createApp({
      api: apiFor(Response.json({ error: "API key inválida", code: "INVALID_API_KEY" }, { status: 401 })),
    }), url, {
      method: "POST",
      headers: sameOriginHeaders(url, { cookie, "content-type": "application/json" }),
      body: "{}",
    });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });

  it("does not call logosagent-api without LOGOSAGENT_API_KEY", async () => {
    const cookie = await asUser(nextEmail("no-key"));
    const url = `${HOST}/api/bible-ai/stream`;
    let called = false;
    const api = { fetch: async () => { called = true; return new Response("ok"); } } as unknown as Fetcher;
    const response = await createApp({ api }).fetch(new Request(url, {
      method: "POST",
      headers: sameOriginHeaders(url, { cookie, "content-type": "application/json" }),
      body: "{}",
    }), { ...env, LOGOSAGENT_API_KEY: "" });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    expect(called).toBe(false);
  });

  it("rate limits the 21st call for one email", async () => {
    const email = nextEmail("burst");
    const cookie = await asUser(email);
    const url = `${HOST}/api/bible-ai/stream`;
    const api = apiFor(new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }));
    let last = 0;
    for (let attempt = 0; attempt < 21; attempt += 1) {
      const response = await call(createApp({ api }), url, {
        method: "POST",
        headers: sameOriginHeaders(url, { cookie, "content-type": "application/json" }),
        body: "{}",
      });
      last = response.status;
      if (attempt < 20) expect(response.status).toBe(200);
    }
    expect(last).toBe(429);
  });
});
