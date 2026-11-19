import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { cx } from "@/lib/cx";

interface PageHeaderProps {
  title: ReactNode;
  /** Small caps line above the large title, e.g. today's date. */
  overline?: ReactNode;
  back?: { to: string; label: string };
  /** Trailing navigation bar items. */
  action?: ReactNode;
}

/**
 * HIG navigation bar with a large title. The bar is transparent at the top of the page;
 * once the large title scrolls away, the bar gains its material and shows an inline title.
 */
export function PageHeader({ title, overline, back, action }: PageHeaderProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), {
      rootMargin: "-52px 0px 0px 0px",
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        className={cx(
          "no-print sticky top-0 z-30 -mx-4 border-b-[0.5px] pt-[env(safe-area-inset-top)] transition-[background-color,border-color] duration-200 sm:-mx-6 md:-mx-10",
          collapsed ? "material border-separator" : "border-transparent",
        )}
      >
        <div className="grid h-[3.25rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2 sm:px-4 md:px-8">
          <div className="flex min-w-0">
            {back && (
              <Link
                to={back.to}
                className="-ml-1 flex min-h-11 min-w-0 items-center gap-0.5 pr-2 text-body text-tint-text transition-opacity active:opacity-50"
              >
                <ChevronLeft aria-hidden className="size-7 shrink-0" strokeWidth={2.3} />
                <span className="truncate">{back.label}</span>
              </Link>
            )}
          </div>
          <div
            aria-hidden={!collapsed}
            className={cx(
              "max-w-[50vw] truncate text-headline font-semibold transition-opacity duration-200",
              collapsed ? "opacity-100" : "opacity-0",
            )}
          >
            {title}
          </div>
          <div className="flex min-w-0 items-center justify-end gap-1">{action}</div>
        </div>
      </div>
      <header className="mb-5">
        {overline && (
          <p className="text-footnote font-semibold tracking-wide text-label-2 uppercase">
            {overline}
          </p>
        )}
        <h1 ref={titleRef} className="text-large-title font-bold tracking-tight">
          {title}
        </h1>
      </header>
    </>
  );
}
