import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { PageError, PageLoader } from "@/components/StateViews";
import { requireAdminRoute } from "@/modules/auth/guards";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context }) => requireAdminRoute(context.queryClient),
  head: () => ({
    meta: [
      { title: "Admin — His Theatre" },
      { name: "description", content: "Officers' desk for dues and ministry money." },
      { property: "og:title", content: "Admin — His Theatre" },
      { property: "og:description", content: "Officers' desk for dues and ministry money." },
    ],
  }),
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
  pendingComponent: PageLoader,
  errorComponent: ({ error }) => <PageError error={error} />,
});
