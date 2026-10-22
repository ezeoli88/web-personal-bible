export interface AllowedEmail {
  email: string;
  enabled: boolean;
  addedBy: string;
  addedAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface AuditRow {
  actor: string;
  action: "add" | "enable" | "disable" | "sync";
  email: string | null;
  ok: boolean;
}

export interface SyncStatus {
  ok: boolean;
  at: string;
}

interface EmailRow {
  email: string;
  enabled: number;
  added_by: string;
  added_at: string;
  updated_by: string | null;
  updated_at: string | null;
}

function mapEmail(row: EmailRow): AllowedEmail {
  return {
    email: row.email,
    enabled: row.enabled === 1,
    addedBy: row.added_by,
    addedAt: row.added_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function findAllowedEmail(db: D1Database, email: string): Promise<AllowedEmail | null> {
  const row = await db
    .prepare(
      `SELECT email, enabled, added_by, added_at, updated_by, updated_at
       FROM allowed_emails WHERE email = ?`,
    )
    .bind(email)
    .first<EmailRow>();
  return row ? mapEmail(row) : null;
}

export async function listAllowedEmails(db: D1Database): Promise<AllowedEmail[]> {
  const result = await db
    .prepare(
      `SELECT email, enabled, added_by, added_at, updated_by, updated_at
       FROM allowed_emails ORDER BY email`,
    )
    .all<EmailRow>();
  return (result.results ?? []).map(mapEmail);
}

export async function listEnabledEmails(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare(`SELECT email FROM allowed_emails WHERE enabled = 1 ORDER BY email`)
    .all<{ email: string }>();
  return (result.results ?? []).map((row) => row.email);
}

export async function insertAllowedEmail(db: D1Database, email: string, actor: string): Promise<void> {
  await db
    .prepare(`INSERT INTO allowed_emails (email, enabled, added_by) VALUES (?, 1, ?)`)
    .bind(email, actor)
    .run();
}

export async function setEmailEnabled(
  db: D1Database,
  email: string,
  enabled: boolean,
  actor: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE allowed_emails
       SET enabled = ?, updated_by = ?, updated_at = datetime('now')
       WHERE email = ?`,
    )
    .bind(enabled ? 1 : 0, actor, email)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function recordAudit(db: D1Database, row: AuditRow): Promise<void> {
  await db
    .prepare(`INSERT INTO admin_audit (actor, action, email, ok) VALUES (?, ?, ?, ?)`)
    .bind(row.actor, row.action, row.email, row.ok ? 1 : 0)
    .run();
}

export async function latestSync(db: D1Database): Promise<SyncStatus | null> {
  const row = await db
    .prepare(`SELECT ok, at FROM admin_audit WHERE action = 'sync' ORDER BY id DESC LIMIT 1`)
    .first<{ ok: number; at: string }>();
  if (!row) return null;
  return { ok: row.ok === 1, at: row.at };
}
