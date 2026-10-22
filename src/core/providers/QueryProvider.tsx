// Ported from biblia-ntv-app/src/providers/QueryProvider.tsx
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WORD_DEFINITION_CACHE_TTL, WORD_DEFINITION_QUERY_KEY } from "../lib/wordDefinitionsCache";

export function createAppQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 30,
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  });
  client.setQueryDefaults(WORD_DEFINITION_QUERY_KEY, {
    staleTime: WORD_DEFINITION_CACHE_TTL,
    gcTime: WORD_DEFINITION_CACHE_TTL,
  });
  return client;
}

export const appQueryClient = createAppQueryClient();

interface Props {
  children: ReactNode;
  client?: QueryClient;
}

export function QueryProvider({ children, client = appQueryClient }: Props) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
