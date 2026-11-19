import { createFileRoute } from "@tanstack/react-router";

import { MoneyScreen } from "@/modules/admin/MoneyScreen";

export const Route = createFileRoute("/admin/money")({
  component: MoneyScreen,
});
