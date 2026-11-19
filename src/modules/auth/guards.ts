import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { toast } from "sonner";

import { currentMemberQuery } from "@/data/queries";
import type { Member } from "@/data/types";
import { isAdmin } from "@/lib/labels";

/** Signed-in routes: no session → sign-in screen. (The real server also enforces this.) */
export async function requireMember(queryClient: QueryClient): Promise<Member> {
  const me = await queryClient.ensureQueryData(currentMemberQuery());
  if (!me) throw redirect({ to: "/sign-in" });
  return me;
}

/** Admin routes: members are sent Home with a message. */
export async function requireAdminRoute(queryClient: QueryClient): Promise<Member> {
  const me = await requireMember(queryClient);
  if (!isAdmin(me)) {
    toast.error("You don't have access to this page.", { id: "no-access" });
    throw redirect({ to: "/" });
  }
  return me;
}

/** Director-only routes: other officers go back to the Admin desk. */
export async function requireSuperAdminRoute(queryClient: QueryClient): Promise<Member> {
  const me = await requireAdminRoute(queryClient);
  if (me.role !== "super_admin") {
    toast.error("Only the Director can open this page.", { id: "no-access" });
    throw redirect({ to: "/admin" });
  }
  return me;
}

export async function redirectIfSignedIn(queryClient: QueryClient) {
  const me = await queryClient.ensureQueryData(currentMemberQuery());
  if (me) throw redirect({ to: "/" });
}
