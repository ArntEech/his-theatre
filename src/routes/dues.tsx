import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { PageError, PageLoader } from "@/components/StateViews";
import { requireMember } from "@/modules/auth/guards";
import { DuesScreen } from "@/modules/dues/DuesScreen";

export const Route = createFileRoute("/dues")({
  beforeLoad: ({ context }) => requireMember(context.queryClient),
  head: () => ({
    meta: [
      { title: "My dues — His Theatre" },
      { name: "description", content: "Week-by-week dues and receipts." },
      { property: "og:title", content: "My dues — His Theatre" },
      { property: "og:description", content: "Week-by-week dues and receipts." },
    ],
  }),
  component: () => (
    <AppShell>
      <DuesScreen />
    </AppShell>
  ),
  pendingComponent: PageLoader,
  errorComponent: ({ error }) => <PageError error={error} />,
});
