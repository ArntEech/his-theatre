import { createFileRoute } from "@tanstack/react-router";

import { SemesterSetupScreen } from "@/modules/admin/SemesterSetupScreen";
import { requireSuperAdminRoute } from "@/modules/auth/guards";

export const Route = createFileRoute("/admin/setup")({
  beforeLoad: ({ context }) => requireSuperAdminRoute(context.queryClient),
  component: SemesterSetupScreen,
});
