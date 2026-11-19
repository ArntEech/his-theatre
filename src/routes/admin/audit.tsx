import { createFileRoute } from "@tanstack/react-router";

import { AuditScreen } from "@/modules/admin/AuditScreen";
import { requireSuperAdminRoute } from "@/modules/auth/guards";

export const Route = createFileRoute("/admin/audit")({
  beforeLoad: ({ context }) => requireSuperAdminRoute(context.queryClient),
  component: AuditScreen,
});
