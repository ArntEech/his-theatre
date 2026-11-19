import { createFileRoute } from "@tanstack/react-router";

import { InstallScreen } from "@/modules/auth/InstallScreen";

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title: "Install — His Theatre" },
      { name: "description", content: "Put His Theatre on your phone's home screen." },
    ],
  }),
  component: InstallScreen,
});
