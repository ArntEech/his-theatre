import type { ReactNode } from "react";
import { Link } from "react-router";
import { cx } from "@/lib/cx";
import { Chevron } from "./List";

/**
 * Health-style summary card: a small coloured label with a glyph, optional meta and chevron,
 * then the content (usually one large figure).
 */
export function SummaryCard({
  label,
  icon,
  meta,
  to,
  children,
  className,
  accent = "text-tint-text",
}: {
  label: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  to?: string;
  children: ReactNode;
  className?: string;
  accent?: string;
}) {
  const body = (
    <>
      <div className="mb-2 flex items-center gap-1.5">
        <span
          className={cx("flex min-w-0 items-center gap-1.5 text-subhead font-semibold", accent)}
        >
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <span className="flex-1" />
        {meta && <span className="shrink-0 text-footnote text-label-2">{meta}</span>}
        {to && <Chevron />}
      </div>
      {children}
    </>
  );
  const base = cx("block rounded-[0.875rem] bg-cell p-4 shadow-[var(--shadow)]", className);
  return to ? (
    <Link to={to} className={cx(base, "transition-transform duration-150 active:scale-[0.985]")}>
      {body}
    </Link>
  ) : (
    <section className={base}>{body}</section>
  );
}

/** A small statistic: number over a caption, used in rows of three. */
export function Stat({
  value,
  label,
  color,
  to,
}: {
  value: ReactNode;
  label: ReactNode;
  color?: string;
  to?: string;
}) {
  const content = (
    <>
      <span className={cx("figure block text-title2 font-bold", color)}>{value}</span>
      <span className="block text-footnote text-label-2">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className="min-w-0 flex-1 rounded-[0.6rem] py-1 active:bg-highlight">
      {content}
    </Link>
  ) : (
    <div className="min-w-0 flex-1 py-1">{content}</div>
  );
}
