import { Link, useRouterState } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { House, ReceiptText, UserRound, Landmark } from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "@/components/Logo";
import { DevPreviewSwitch } from "@/components/DevPreviewSwitch";
import { OfflineBanner } from "@/components/OfflineBanner";
import { IS_MOCK } from "@/data/api";
import { currentMemberQuery } from "@/data/queries";
import { isAdmin } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useSuspenseQuery(currentMemberQuery());
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs = [
    { to: "/", label: "Home", icon: House, active: pathname === "/" },
    { to: "/dues", label: "Dues", icon: ReceiptText, active: pathname.startsWith("/dues") },
    { to: "/profile", label: "Profile", icon: UserRound, active: pathname.startsWith("/profile") },
    ...(isAdmin(me)
      ? [{ to: "/admin", label: "Admin", icon: Landmark, active: pathname.startsWith("/admin") }]
      : []),
  ] as const;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 print:hidden border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-lg items-center gap-2.5 px-4">
          <Logo className="h-9 w-7" />
          <span className="font-display text-lg font-semibold tracking-tight">His Theatre</span>
          <div className="ml-auto">{IS_MOCK && <DevPreviewSwitch />}</div>
        </div>
      </header>

      <OfflineBanner />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-32 pt-5 print:max-w-none print:p-0">{children}</main>

      <nav
        aria-label="Main"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 print:hidden border-t-2 border-gold-deep bg-stage text-stage-foreground"
      >
        <ul className="mx-auto grid max-w-lg auto-cols-fr grid-flow-col">
          {tabs.map(({ to, label, icon: Icon, active }) => (
            <li key={to}>
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 pt-1.5 text-sm font-semibold transition-colors",
                  active ? "text-gold" : "text-stage-foreground/85 hover:text-stage-foreground",
                )}
              >
                {active && <span className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-gold" aria-hidden />}
                <Icon className="size-6" aria-hidden strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
