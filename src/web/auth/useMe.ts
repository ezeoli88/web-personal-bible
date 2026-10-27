import { queryOptions } from "@tanstack/react-query";

/** Monthly AI requests of a reader; the admin has none. */
export interface AiQuota {
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
}

export interface Me {
  authenticated: boolean;
  email?: string;
  role?: "admin" | "user" | null;
  aiQuota?: AiQuota | null;
}

export const meQueryKey = ["me"] as const;

export async function fetchMe(): Promise<Me> {
  const response = await fetch("/api/me");
  if (!response.ok) return { authenticated: false };
  return response.json() as Promise<Me>;
}

export function meQueryOptions() {
  return queryOptions({
    queryKey: meQueryKey,
    queryFn: fetchMe,
    staleTime: 30_000,
    retry: false,
  });
}
