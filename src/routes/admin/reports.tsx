import { createFileRoute } from "@tanstack/react-router";

import { ReportsScreen } from "@/modules/admin/ReportsScreen";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsScreen,
});
