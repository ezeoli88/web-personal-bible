import { createFileRoute, redirect } from "@tanstack/react-router";
import { meQueryOptions } from "../web/auth/useMe";
import { AdminPage } from "../web/pages/AdminPage";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions());
    if (!me.authenticated) {
      throw redirect({ href: "/auth/login?returnTo=%2Fadmin" });
    }
    if (me.role !== "admin") {
      throw redirect({ to: "/" });
    }
  },
  component: AdminPage,
});
