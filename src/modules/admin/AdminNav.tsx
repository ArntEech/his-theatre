import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";

import { currentMemberQuery } from "@/data/queries";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/admin", label: "Today", exact: true, director: false },
  { to: "/admin/members", label: "Members", director: false },
  { to: "/admin/money", label: "In / Out", director: false },
  { to: "/admin/reports", label: "Reports", director: false },
  { to: "/admin/setup", label: "Semester", director: true },
  { to: "/admin/roles", label: "Roles", director: true },
  { to: "/admin/audit", label: "Audit log", director: true },
] as const;

export function AdminNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: me } = useSuspenseQuery(currentMemberQuery());
  const isDirector = me?.role === "super_admin";
  return (
    <nav aria-label="Admin" className="-mx-4 mb-5 overflow-x-auto px-4 [scrollbar-width:none] print:hidden">
      <ul className="flex w-max gap-2">
        {LINKS.filter((l) => !l.director || isDirector).map((l) => {
          const active =
            "exact" in l
              ? pathname === l.to || pathname === `${l.to}/`
              : pathname.startsWith(l.to) || (l.to === "/admin/members" && pathname.startsWith("/admin/member/"));
          return (
            <li key={l.to}>
              <Link
                to={l.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-full border-2 px-4 font-semibold transition-colors",
                  active ? "border-gold-deep bg-gold text-primary-foreground" : "border-border bg-card hover:border-gold-deep",
                )}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
