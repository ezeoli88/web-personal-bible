import type { AuthVariables } from "./auth/middleware";

export interface AppEnv {
  Bindings: Env;
  Variables: AuthVariables;
}

export interface AppDeps {
  /** Overrides the logosagent-api service binding. Tests inject a mock Fetcher. */
  api?: Fetcher;
  /** Overrides global fetch for OIDC and the Access API. */
  fetch?: typeof fetch;
}
