import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useCurrentMember } from "@/data/queries";
import { isAdmin } from "@/lib/roles";
import { useFlash } from "./Flash";
import { Logo } from "./Logo";
import { ActivityIndicator } from "./ActivityIndicator";

export function Curtain() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6">
      <Logo className="w-16" />
      <ActivityIndicator className="text-[1.6rem] text-label-2" label="Loading His Theatre" />
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: member, isPending } = useCurrentMember();
  const location = useLocation();
  if (isPending) return <Curtain />;
  if (!member) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export const NO_ACCESS_MESSAGE = "You don't have access to this page.";

/** Client-side guard for officer pages. The real server enforces the same rule. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { data: member } = useCurrentMember();
  const allowed = isAdmin(member);
  const flash = useFlash();

  useEffect(() => {
    if (member && !allowed) flash(NO_ACCESS_MESSAGE, "error");
  }, [member, allowed, flash]);

  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { data: member, isPending } = useCurrentMember();
  if (isPending) return <Curtain />;
  if (member) return <Navigate to="/" replace />;
  return <>{children}</>;
}
