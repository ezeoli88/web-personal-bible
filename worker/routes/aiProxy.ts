import type { Hono } from "hono";
import { requireAllowed, requireSession } from "../auth/middleware";
import { AI_MONTHLY_LIMIT, consumeAiQuota, refundAiQuota, type AiQuota } from "../db/aiUsage";
import { apiError, logEvent, MAX_AI_BODY_BYTES, readLimitedBody } from "../lib/http";
import type { AppDeps, AppEnv } from "../app-env";

const RESPONSE_HEADERS = ["content-type", "x-request-id", "retry-after"] as const;
const UNAVAILABLE_MESSAGE = "La IA no está disponible en este momento.";

/** Requests answered from the lexicon alone, without the model: they do not use the quota. */
function usesModel(body: Uint8Array): boolean {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(body)) as { mode?: unknown; step?: unknown };
    return !(parsed.mode === "words" && parsed.step === "study");
  } catch {
    return true;
  }
}

export function registerAiProxy(app: Hono<AppEnv>, deps: AppDeps): void {
  app.post("/api/bible-ai/stream", requireSession, requireAllowed, async (c) => {
    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return apiError(c, 415, "UNSUPPORTED_MEDIA_TYPE", "El cuerpo tiene que ser JSON.");
    }

    const declaredLength = Number(c.req.header("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_AI_BODY_BYTES) {
      return apiError(c, 413, "PAYLOAD_TOO_LARGE", "El cuerpo supera el tamaño permitido.");
    }

    const body = await readLimitedBody(c.req.raw, MAX_AI_BODY_BYTES);
    if (body === "too-large") {
      return apiError(c, 413, "PAYLOAD_TOO_LARGE", "El cuerpo supera el tamaño permitido.");
    }

    const email = c.get("email");
    const limit = await c.env.AI_RATE_LIMITER.limit({ key: email });
    if (!limit.success) {
      c.header("Retry-After", "60");
      return apiError(c, 429, "RATE_LIMIT_EXCEEDED", "Demasiadas solicitudes. Probá de nuevo en un minuto.");
    }

    // logosagent-api falla cerrado sin esta clave: sin el secreto no tiene sentido llamarlo.
    const apiKey = c.env.LOGOSAGENT_API_KEY;
    if (!apiKey) {
      logEvent("ai.api_key_missing", {}, "error");
      return apiError(c, 502, "UPSTREAM_UNAVAILABLE", UNAVAILABLE_MESSAGE);
    }

    // The monthly quota is counted before calling the API and given back if
    // the API fails, rejects the request or answers from its cache, so only
    // answers from the model count.
    let quota: AiQuota | null = null;
    if (c.get("role") !== "admin" && usesModel(body)) {
      quota = await consumeAiQuota(c.env.DB, email);
      if (!quota) {
        return apiError(
          c,
          429,
          "MONTHLY_QUOTA_EXCEEDED",
          `Usaste las ${AI_MONTHLY_LIMIT} consultas de IA de este mes. Se renuevan el 1.º del mes que viene.`,
        );
      }
    }
    const refund = async () => {
      if (!quota) return;
      try {
        await refundAiQuota(c.env.DB, email);
      } catch (error) {
        logEvent("ai.quota_refund_failed", { error: error instanceof Error ? error.message : String(error) }, "error");
      }
    };

    const requestId = c.req.header("x-request-id") || crypto.randomUUID();
    const headers = new Headers();
    headers.set("content-type", "application/json");
    headers.set("accept", c.req.header("accept") || "application/json, text/event-stream");
    headers.set("x-request-id", requestId);
    headers.set("x-api-key", apiKey);
    const ip = c.req.header("cf-connecting-ip");
    if (ip) headers.set("cf-connecting-ip", ip);

    const api = deps.api ?? c.env.API;
    try {
      const upstream = await api.fetch("https://logosagent-api/api/bible-ai/stream", {
        method: "POST",
        headers,
        body,
      });
      // Un 401 del Worker es una clave mal configurada, no un problema de la sesión del usuario.
      if (upstream.status >= 400) await refund();
      if (upstream.status === 401) {
        await upstream.body?.cancel();
        logEvent("ai.upstream_unauthorized", { requestId }, "error");
        return apiError(c, 502, "UPSTREAM_UNAVAILABLE", UNAVAILABLE_MESSAGE);
      }
      const responseHeaders = new Headers();
      for (const name of RESPONSE_HEADERS) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders.set(name, value);
      }
      // An answer from logosagent-api's cache did not use the model, so it does not use the quota either.
      if (quota && upstream.status < 400 && upstream.headers.get("x-ai-cache") === "hit") {
        await refund();
        quota = { ...quota, used: quota.used - 1, remaining: quota.remaining + 1 };
      }
      if (quota && upstream.status < 400) responseHeaders.set("x-ai-quota-remaining", String(quota.remaining));
      responseHeaders.set("cache-control", "no-cache, no-transform");
      responseHeaders.set("x-content-type-options", "nosniff");
      return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
    } catch (error) {
      await refund();
      logEvent("ai.upstream_failed", {
        error: error instanceof Error ? error.message : String(error),
      }, "error");
      return apiError(c, 502, "UPSTREAM_UNAVAILABLE", UNAVAILABLE_MESSAGE);
    }
  });
}
