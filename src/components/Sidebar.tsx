import { NavLink } from "react-router";
import {
  ClipboardCheck,
  ChevronRight,
  ArrowLeftRight,
  CalendarDays,
  ClipboardList,
  FileText,
  HandCoins,
  ReceiptText,
  Sun,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Member } from "@/data/types";
import { isAdmin, roleLabel } from "@/lib/roles";
import { cx } from "@/lib/cx";
import { Logo } from "./Logo";
import { MemberAvatar } from "./Avatar";
import { mainNav } from "./TabBar";
import { useUnreadNews } from "@/data/queries";

const ADMIN_LINKS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/admin/today", label: "Today", icon: Sun },
  { to: "/admin/pay", label: "Record Payment", icon: ReceiptText },
  { to: "/admin/members", label: "Members", icon: Users },
  { to: "/admin/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/admin/handovers", label: "Handovers", icon: ArrowLeftRight },
  { to: "/admin/expenses", label: "Expenses", icon: Wallet },
  { to: "/admin/income", label: "Other Income", icon: HandCoins },
  { to: "/admin/reports", label: "Reports", icon: FileText },
  { to: "/admin/semester", label: "Semester", icon: CalendarDays },
  { to: "/admin/audit", label: "Audit Log", icon: ClipboardList },
];

const rowClass = (isActive: boolean) =>
  cx(
    "flex min-h-11 items-center gap-3 rounded-[0.6rem] px-3 text-body transition-colors",
    isActive
      ? "bg-tint font-semibold text-on-tint"
      : "text-label hover:bg-fill active:bg-fill-strong",
  );

/** iPad-style sidebar that replaces the tab bar at regular widths. */
export function Sidebar({ member }: { member: Member | null | undefined }) {
  const admin = isAdmin(member);
  const unread = useUnreadNews().data ?? 0;
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[17.5rem] flex-col border-r-[0.5px] border-separator bg-cell/60 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] md:flex">
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <Logo className="w-9" />
        <span className="text-title3 font-bold">His Theatre</span>
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-0.5">
          {mainNav(admin).map(({ to, label, glyph: Glyph, end, soon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/admin" ? true : end}
                className={({ isActive }) => rowClass(isActive)}
              >
                {({ isActive }) => (
                  <>
                    <Glyph
                      filled={isActive}
                      className={cx("size-[1.4rem]", !isActive && "text-tint-text")}
                    />
                    {label}
                    {to === "/announcements" && unread > 0 && !isActive && (
                      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-behind px-1.5 text-caption2 font-bold text-white">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                    {soon && (
                      <span className="ml-auto rounded-full bg-fill px-2 py-0.5 text-caption2 font-semibold text-label-2">
                        Soon
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        {admin && (
          <>
            <p className="mt-6 mb-1.5 px-3 text-footnote font-semibold tracking-wide text-label-2 uppercase">
              Admin
            </p>
            <ul className="space-y-0.5">
              {ADMIN_LINKS.filter(
                (l) => l.to !== "/admin/audit" || member?.role === "super_admin",
              ).map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink to={to} className={({ isActive }) => rowClass(isActive)}>
                    {({ isActive }) => (
                      <>
                        <Icon
                          aria-hidden
                          className={cx("size-5", !isActive && "text-tint-text")}
                          strokeWidth={2}
                        />
                        {label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>
      {member && (
        <NavLink
          to="/profile"
          aria-label={`Your account: ${member.fullName}`}
          className={({ isActive }) =>
            cx(
              "flex items-center gap-3 border-t-[0.5px] border-separator px-5 py-4 transition-colors hover:bg-fill active:bg-fill",
              isActive && "bg-fill",
            )
          }
        >
          <MemberAvatar memberId={member.id} name={member.fullName} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-subhead font-semibold">{member.fullName}</span>
            <span className="block truncate text-footnote text-label-2">{roleLabel(member)}</span>
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-label-3" />
        </NavLink>
      )}
    </aside>
  );
}
