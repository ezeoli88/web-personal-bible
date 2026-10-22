import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";

const bound = env as typeof env & { TEST_MIGRATIONS?: D1Migration[] };
if (!bound.TEST_MIGRATIONS) {
  throw new Error("Falta el binding TEST_MIGRATIONS");
}
await applyD1Migrations(env.DB, bound.TEST_MIGRATIONS);
