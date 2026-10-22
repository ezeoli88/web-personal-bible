import { queryOptions } from "@tanstack/react-query";

export interface Me {
  authenticated: boolean;
  email?: string;
  role?: "admin" | "user" | null;
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
