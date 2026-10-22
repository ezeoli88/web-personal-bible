import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { QueryProvider } from "../core/providers/QueryProvider";
import { ThemeProvider } from "../core/providers/ThemeProvider";
import { DatabaseProvider } from "../core/hooks/DatabaseProvider";
import { AuthProvider } from "../web/auth/AuthProvider";
import { AppShell } from "../web/layout/AppShell";
import { ToastHost } from "../web/ui/ToastHost";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryProvider client={queryClient}>
      <ThemeProvider>
        <DatabaseProvider>
          <AuthProvider>
            <AppShell>
              <Outlet />
            </AppShell>
            <ToastHost />
          </AuthProvider>
        </DatabaseProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
