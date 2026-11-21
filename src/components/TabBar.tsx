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

/**
 * Floating tab bar for phones, in the style of Telegram and Pinterest: a rounded glass bar
 * that floats just above the bottom of the screen. The selected tab opens into a pill with
 * its name; the others show only their icon. Tablets and laptops use the sidebar instead.
 */
export function TabBar({ showAdmin }: { showAdmin: boolean }) {
  return (
    <nav
      aria-label="Main"
      className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[calc(0.625rem+env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] md:hidden"
    >
      <ul className="tabbar material pointer-events-auto mx-auto flex max-w-[26rem] items-center justify-between gap-1 rounded-full p-1.5 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.35),0_2px_8px_-2px_rgb(0_0_0/0.12)] ring-[0.5px] ring-separator">
        {mainNav(showAdmin).map(({ to, label, glyph: Glyph, end }) => (
          <li key={to} className="flex min-w-0 flex-[1_1_0] justify-center has-[[aria-current=page]]:flex-[1.9_1_0]">
            <NavLink
              to={to}
              end={end}
              aria-label={label}
              className={({ isActive }) =>
                cx(
                  "group flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-full px-3 transition-[background-color,color,padding,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-90",
                  isActive
                    ? "w-full bg-tint/20 text-tint-text"
                    : "text-label-2 hover:text-label",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Glyph
                    filled={isActive}
                    className={cx(
                      "size-[1.5rem] shrink-0 transition-transform duration-300",
                      isActive && "scale-105",
                    )}
                  />
                  <span
                    aria-hidden
                    className={cx(
                      "overflow-hidden text-subhead font-semibold whitespace-nowrap transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                      isActive ? "max-w-[6rem] opacity-100" : "max-w-0 opacity-0",
                    )}
                  >
                    {label}
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
