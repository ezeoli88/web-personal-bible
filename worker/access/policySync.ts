import { listEnabledEmails } from "../db/allowedEmails";
import { normalizeEmail } from "../auth/authz";

export interface PolicySyncResult {
  ok: boolean;
  error?: string;
  include?: string[];
}

interface AccessRule {
  email?: { email?: string };
  [key: string]: unknown;
}

interface AccessPolicy {
  name?: string;
  decision?: string;
  include?: AccessRule[];
  exclude?: unknown[];
  require?: unknown[];
}

function policyUrl(env: Env): string {
  return `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/policies/${env.ACCESS_POLICY_ID}`;
}

function authHeaders(env: Env): Headers {
  return new Headers({
    authorization: `Bearer ${env.CF_API_TOKEN}`,
    "content-type": "application/json",
  });
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { errors?: Array<{ message?: string }>; error?: string };
    const message = payload.errors?.map((item) => item.message).filter(Boolean).join("; ");
    return message || payload.error || `Cloudflare Access respondió ${response.status}`;
  } catch {
    return `Cloudflare Access respondió ${response.status}`;
  }
}

/**
 * PUT the reusable Access policy so only the admin and enabled emails receive a PIN.
 * Disabled emails are left out of `include`.
 *
 * Body checked against the Access reusable policy schema (Oct 2026):
 * PUT /accounts/{account_id}/access/policies/{policy_id}
 * Email rule: `{ "email": { "email": "user@example.com" } }`.
 */
export async function syncAccessPolicy(env: Env, fetchImpl: typeof fetch = fetch): Promise<PolicySyncResult> {
  const enabled = await listEnabledEmails(env.DB);
  const admin = normalizeEmail(env.ADMIN_EMAIL);
  const emails = [admin, ...enabled.filter((email) => email !== admin)];
  const include = emails.map((email) => ({ email: { email } }));

  let existing: AccessPolicy = {};
  const current = await fetchImpl(policyUrl(env), { method: "GET", headers: authHeaders(env) });
  if (current.ok) {
    const payload = await current.json() as { result?: AccessPolicy };
    existing = payload.result ?? {};
  }

  const body = {
    name: existing.name || "biblia-ia-whitelist",
    decision: "allow",
    include,
    exclude: existing.exclude ?? [],
    require: existing.require ?? [],
  };

  const response = await fetchImpl(policyUrl(env), {
    method: "PUT",
    headers: authHeaders(env),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return { ok: false, error: await readError(response), include: emails };
  }
  const payload = await response.json() as { success?: boolean; errors?: Array<{ message?: string }> };
  if (payload.success === false) {
    const message = payload.errors?.map((item) => item.message).filter(Boolean).join("; ");
    return { ok: false, error: message || "Cloudflare Access rechazó la política.", include: emails };
  }
  return { ok: true, include: emails };
}
