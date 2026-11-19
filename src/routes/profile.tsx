import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { PageError, PageLoader } from "@/components/StateViews";
import { requireMember } from "@/modules/auth/guards";
import { ProfileScreen } from "@/modules/dues/ProfileScreen";

export const Route = createFileRoute("/profile")({
  beforeLoad: ({ context }) => requireMember(context.queryClient),
  head: () => ({
    meta: [
      { title: "Profile — His Theatre" },
      { name: "description", content: "Your member details and PIN." },
      { property: "og:title", content: "Profile — His Theatre" },
      { property: "og:description", content: "Your member details and PIN." },
    ],
  }),
  component: () => (
    <AppShell>
      <ProfileScreen />
    </AppShell>
  ),
  pendingComponent: PageLoader,
  errorComponent: ({ error }) => <PageError error={error} />,
});
