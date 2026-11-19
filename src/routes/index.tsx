import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { PageError, PageLoader } from "@/components/StateViews";
import { requireMember } from "@/modules/auth/guards";
import { HomeScreen } from "@/modules/dues/HomeScreen";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => requireMember(context.queryClient),
  head: () => ({
    meta: [
      { title: "His Theatre" },
      { name: "description", content: "Your dues, receipts and ministry finances for HIS Theatre Ministry." },
      { property: "og:title", content: "His Theatre" },
      { property: "og:description", content: "Your dues, receipts and ministry finances for HIS Theatre Ministry." },
    ],
  }),
  component: () => (
    <AppShell>
      <HomeScreen />
    </AppShell>
  ),
  pendingComponent: PageLoader,
  errorComponent: ({ error }) => <PageError error={error} />,
});
