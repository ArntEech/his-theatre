import { NavLink } from "react-router";
import { cx } from "@/lib/cx";
import { AdminGlyph, DuesGlyph, HomeGlyph, ProfileGlyph } from "./TabIcons";

export interface NavItem {
  to: string;
  label: string;
  glyph: typeof HomeGlyph;
  end?: boolean;
}

export function mainNav(showAdmin: boolean): NavItem[] {
  return [
    { to: "/", label: "Home", glyph: HomeGlyph, end: true },
    { to: "/dues", label: "Dues", glyph: DuesGlyph },
    ...(showAdmin ? [{ to: "/admin", label: "Admin", glyph: AdminGlyph }] : []),
    { to: "/profile", label: "Profile", glyph: ProfileGlyph },
  ];
}

/** HIG tab bar for compact widths: translucent material, filled glyph for the selected tab. */
export function TabBar({ showAdmin }: { showAdmin: boolean }) {
  return (
    <nav
      aria-label="Main"
      className="no-print material fixed inset-x-0 bottom-0 z-40 border-t-[0.5px] border-separator pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] md:hidden"
    >
      <ul className="mx-auto flex max-w-xl">
        {mainNav(showAdmin).map(({ to, label, glyph: Glyph, end }) => (
          <li key={to} className="min-w-0 flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  "flex min-h-[3.0625rem] flex-col items-center justify-center gap-0.5 px-1 pt-1.5 pb-1 transition-opacity active:opacity-60",
                  isActive ? "text-tint-text" : "text-label-2",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Glyph filled={isActive} className="size-[1.6rem]" />
                  <span className="max-w-full truncate text-caption2 font-medium">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
