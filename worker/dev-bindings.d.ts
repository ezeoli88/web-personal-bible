/** Dev-only bindings. They are never required in production. */
interface Env {
  DEV_AUTH_BYPASS?: string;
  DEV_USER_EMAIL?: string;
  /** Injected by the Workers Vitest pool. */
  TEST_MIGRATIONS?: unknown;
}
