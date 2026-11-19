import { createFileRoute } from "@tanstack/react-router";

import { TodayScreen } from "@/modules/admin/TodayScreen";

export const Route = createFileRoute("/admin/")({
  component: TodayScreen,
});
