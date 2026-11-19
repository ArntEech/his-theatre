import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { PageError, PageLoader } from "@/components/StateViews";
import { requireMember } from "@/modules/auth/guards";
import { ReceiptScreen } from "@/modules/dues/ReceiptScreen";

export const Route = createFileRoute("/receipt/$paymentId")({
  beforeLoad: ({ context }) => requireMember(context.queryClient),
  head: () => ({
    meta: [
      { title: "Receipt — His Theatre" },
      { name: "description", content: "A His Theatre dues receipt." },
    ],
  }),
  component: ReceiptRoute,
  pendingComponent: PageLoader,
  errorComponent: ({ error }) => <PageError error={error} />,
});

function ReceiptRoute() {
  const { paymentId } = Route.useParams();
  return (
    <AppShell>
      <ReceiptScreen paymentId={paymentId} />
    </AppShell>
  );
}
