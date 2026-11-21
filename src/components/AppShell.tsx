import { Outlet, useLocation, useNavigationType } from "react-router";
import { useEffect, useRef } from "react";
import { useCurrentMember } from "@/data/queries";
import { isAdmin } from "@/lib/roles";
import { isDemo } from "@/lib/env";
import { TabBar } from "./TabBar";
import { Sidebar } from "./Sidebar";
import { PreviewAs } from "./PreviewAs";
import { OfflineBanner } from "./OfflineBanner";
import { ThemeToggle } from "./ThemeToggle";
import { PullToRefresh } from "./PullToRefresh";

const depth = (path: string) => path.split("/").filter(Boolean).length;
const section = (path: string) => path.split("/").filter(Boolean)[0] ?? "";

/**
 * Picks the transition for a route change: deeper pages push in from the trailing edge,
 * going back pops in from the leading edge, and switching tabs dissolves (as in iOS).
 */
function useRouteAnimation(pathname: string) {
  const navType = useNavigationType();
  const previous = useRef(pathname);
  let animation = "anim-fade";
  const prev = previous.current;
  if (prev !== pathname && section(prev) === section(pathname)) {
    if (navType === "POP" || depth(pathname) < depth(prev)) animation = "anim-pop";
    else if (depth(pathname) > depth(prev)) animation = "anim-push";
  }
  useEffect(() => {
    previous.current = pathname;
  }, [pathname]);
  return animation;
}

export function AppShell() {
  const { data: member } = useCurrentMember();
  const { pathname } = useLocation();
  const animation = useRouteAnimation(pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-dvh overflow-x-clip md:pl-[17.5rem]">
      <Sidebar member={member} />
      <PullToRefresh />
      {isDemo && <PreviewAs />}
      <main className="mx-auto w-full max-w-[44rem] px-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(6.5rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] sm:px-6 md:px-10 md:pb-16">
        <OfflineBanner />
        <div key={pathname} className={animation}>
          <Outlet />
        </div>
      </main>
      <TabBar showAdmin={isAdmin(member)} />
    </div>
  );
}

/** Layout for sign-in screens: no tab bar. */
export function BareShell() {
  return (
    <div className="min-h-dvh">
      {isDemo && <PreviewAs />}
      <main className="mx-auto flex w-full max-w-[26rem] flex-col px-5 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <OfflineBanner />
        <div className="anim-fade">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
