/** AI requests each reader can make per calendar month (UTC). The admin has no limit. */
export const AI_MONTHLY_LIMIT = 100;

export interface AiQuota {
  limit: number;
  used: number;
  remaining: number;
  /** First instant of next month, when the count starts over. */
  resetsAt: string;
}

export function usageMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

function nextMonthStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

function toQuota(used: number, now: Date): AiQuota {
  return {
    limit: AI_MONTHLY_LIMIT,
    used,
    remaining: Math.max(0, AI_MONTHLY_LIMIT - used),
    resetsAt: nextMonthStart(now),
  };
}

export async function readAiQuota(db: D1Database, email: string, now = new Date()): Promise<AiQuota> {
  const row = await db
    .prepare("SELECT count FROM ai_usage WHERE email = ? AND month = ?")
    .bind(email, usageMonth(now))
    .first<{ count: number }>();
  return toQuota(row?.count ?? 0, now);
}

/**
 * Counts one request if the month still has room, in a single statement so two
 * requests at once cannot both take the last one. Returns null when it is used up.
 */
export async function consumeAiQuota(db: D1Database, email: string, now = new Date()): Promise<AiQuota | null> {
  const row = await db
    .prepare(
      `INSERT INTO ai_usage (email, month, count) VALUES (?, ?, 1)
       ON CONFLICT (email, month) DO UPDATE SET count = count + 1 WHERE count < ?
       RETURNING count`,
    )
    .bind(email, usageMonth(now), AI_MONTHLY_LIMIT)
    .first<{ count: number }>();
  return row ? toQuota(row.count, now) : null;
}

/** Gives back a request that never got an answer (the API failed or rejected it). */
export async function refundAiQuota(db: D1Database, email: string, now = new Date()): Promise<void> {
  await db
    .prepare("UPDATE ai_usage SET count = count - 1 WHERE email = ? AND month = ? AND count > 0")
    .bind(email, usageMonth(now))
    .run();
}
