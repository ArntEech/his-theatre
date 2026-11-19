import { createFileRoute } from "@tanstack/react-router";

import { redirectIfSignedIn } from "@/modules/auth/guards";
import { SignInScreen } from "@/modules/auth/SignInScreen";

export const Route = createFileRoute("/sign-in")({
  beforeLoad: ({ context }) => redirectIfSignedIn(context.queryClient),
  head: () => ({
    meta: [
      { title: "Sign in — His Theatre" },
      { name: "description", content: "Sign in to His Theatre, the app of HIS Theatre Ministry." },
      { property: "og:title", content: "Sign in — His Theatre" },
      { property: "og:description", content: "Sign in to His Theatre, the app of HIS Theatre Ministry." },
    ],
  }),
  component: SignInScreen,
});
