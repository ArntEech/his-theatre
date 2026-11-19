import { createFileRoute } from "@tanstack/react-router";

import { RolesScreen } from "@/modules/admin/RolesScreen";
import { requireSuperAdminRoute } from "@/modules/auth/guards";

export const Route = createFileRoute("/admin/roles")({
  beforeLoad: ({ context }) => requireSuperAdminRoute(context.queryClient),
  component: RolesScreen,
});
