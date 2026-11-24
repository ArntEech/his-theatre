import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { useCurrentMember } from "@/data/queries";
import { cx } from "@/lib/cx";
import { MemberAvatar } from "./Avatar";
import { ThemeToggle } from "./ThemeToggle";

interface PageHeaderProps {
  title: ReactNode;
  /** A small line at the top of the page, e.g. the semester's name. On Home, the date. */
  overline?: ReactNode;
  back?: { to: string; label: string };
  /** Extra buttons for this page, shown before the Day/Night toggle and your picture. */
  action?: ReactNode;
  /** Home only: the bar shows no title; `title` (the greeting) is the heading in the page. */
  large?: boolean;
}

/**
 * Navigation bar in the style of Telegram: a small centred title, Back on the left when there
 * is somewhere to go back to, and the Day/Night toggle plus your picture on the right. Both
 * sides are the same width, so the title is always in the middle.
 */
export function PageHeader({ title, overline, back, action, large }: PageHeaderProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const { data: me } = useCurrentMember();

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      rootMargin: "-40px 0px 0px 0px",
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const showTitle = !large;

  return (
    <>
      <div
        className={cx(
          "no-print sticky top-0 z-30 -mx-4 border-b-[0.5px] pt-[env(safe-area-inset-top)] transition-[background-color,border-color] duration-200 sm:-mx-6 md:-mx-10",
          scrolled ? "material border-separator" : "border-transparent",
        )}
      >
        <div className="grid h-[3.25rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 px-2 sm:px-4 md:px-8">
          <div className="flex min-w-0">
            {back ? (
              <Link
                to={back.to}
                aria-label={`Back to ${back.label}`}
                className="-ml-1 flex min-h-11 min-w-0 items-center gap-0.5 pr-2 text-body text-tint-text transition-opacity active:opacity-50"
              >
                <ChevronLeft aria-hidden className="size-7 shrink-0" strokeWidth={2.3} />
                <span className="truncate max-[380px]:sr-only">{back.label}</span>
              </Link>
            ) : null}
          </div>
          <div
            aria-hidden={!showTitle}
            className={cx(
              "max-w-[46vw] truncate text-center text-headline font-semibold transition-opacity duration-200 md:max-w-[22rem]",
              showTitle ? "opacity-100" : "opacity-0",
            )}
          >
            {title}
          </div>
          <div className="flex min-w-0 items-center justify-end">
            {action}
            <ThemeToggle />
            {me && (
              <Link
                to="/profile"
                aria-label={`Your account: ${me.fullName}`}
                className="ml-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-opacity active:opacity-60 md:hidden"
              >
                <MemberAvatar memberId={me.id} name={me.fullName} size="sm" />
              </Link>
            )}
          </div>
        </div>
      </div>
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {large ? (
        <header className="mb-5">
          <h1 className="text-title1 font-bold tracking-tight">{title}</h1>
          {overline && <p className="mt-0.5 text-subhead text-label-2">{overline}</p>}
        </header>
      ) : (
        <>
          <h1 className="sr-only">{title}</h1>
          {overline && (
            <p className="mt-1 mb-4 text-center text-footnote font-semibold tracking-wide text-label-2 uppercase">
              {overline}
            </p>
          )}
          {!overline && <div className="h-3" />}
        </>
      )}
    </>
  );
}
