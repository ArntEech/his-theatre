import { NavLink } from "react-router";
import { cx } from "@/lib/cx";
import {
  AdminGlyph,
  AnnouncementsGlyph,
  AttendanceGlyph,
  DuesGlyph,
  HomeGlyph,
  SettingsGlyph,
} from "./TabIcons";

export interface NavItem {
  to: string;
  label: string;
  glyph: typeof HomeGlyph;
  end?: boolean;
  /** A shorter name for the phone tab bar, where space is tight. */
  short?: string;
  /** Still being built: shows a "Soon" badge in the sidebar. */
  soon?: boolean;
}

/** Every place in the app, for the sidebar on tablets and laptops. */
export function mainNav(showAdmin: boolean): NavItem[] {
  return [
    { to: "/", label: "Home", glyph: HomeGlyph, end: true },
    { to: "/dues", label: "Dues", glyph: DuesGlyph },
    ...(showAdmin ? [{ to: "/admin", label: "Admin", glyph: AdminGlyph }] : []),
    // In development: their pages say "Coming soon" for now.
    { to: "/attendance", label: "Attendance", glyph: AttendanceGlyph, soon: true },
    { to: "/announcements", label: "Announcements", short: "News", glyph: AnnouncementsGlyph, soon: true },
    { to: "/settings", label: "Settings", glyph: SettingsGlyph },
  ];
}

/**
 * The four phone tabs. Members: Home, Dues, News, Settings. Officers swap Dues for Admin
 * (their own dues are one tap away on Home). Attendance is a card on Home.
 */
export function phoneTabs(showAdmin: boolean): NavItem[] {
  return [
    { to: "/", label: "Home", glyph: HomeGlyph, end: true },
    showAdmin
      ? { to: "/admin", label: "Admin", glyph: AdminGlyph }
      : { to: "/dues", label: "Dues", glyph: DuesGlyph },
    { to: "/announcements", label: "Announcements", short: "News", glyph: AnnouncementsGlyph },
    { to: "/settings", label: "Settings", glyph: SettingsGlyph },
  ];
}

/**
 * Floating tab bar for phones, in the style of Telegram: a rounded glass bar just above the
 * bottom of the screen, each tab an icon with its name in small letters underneath. The
 * selected tab is tinted gold. Tablets and laptops use the sidebar instead.
 */
export function TabBar({ showAdmin }: { showAdmin: boolean }) {
  return (
    <nav
      aria-label="Main"
      className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[calc(0.25rem+env(safe-area-inset-bottom)*0.6)] pl-[max(0.75rem,env(safe-area-inset-left))] md:hidden"
    >
      <ul className="tabbar material pointer-events-auto mx-auto flex max-w-[28rem] items-stretch gap-0.5 rounded-full p-1 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.35),0_2px_8px_-2px_rgb(0_0_0/0.12)] ring-[0.5px] ring-separator">
        {phoneTabs(showAdmin).map(({ to, label, short, glyph: Glyph, end }) => (
          <li key={to} className="flex min-w-0 flex-1">
            <NavLink
              to={to}
              end={end}
              aria-label={label}
              className={({ isActive }) =>
                cx(
                  "flex w-full flex-col items-center justify-center gap-0.5 rounded-full py-1.5 transition-[background-color,color,transform] duration-200 active:scale-95",
                  isActive ? "bg-tint/18 text-tint-text" : "text-label-2 hover:text-label",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Glyph filled={isActive} className="size-[1.45rem] shrink-0" />
                  <span aria-hidden className="text-[0.6875rem] leading-tight font-semibold">
                    {short ?? label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
