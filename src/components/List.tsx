import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cx } from "@/lib/cx";

/**
 * HIG inset grouped list. Sections have an optional header and footer;
 * rows are at least 44 points tall with separators inset to the text.
 */
export function ListSection({
  header,
  footer,
  aside,
  children,
  className,
  padded,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Plain content (a form, a chart) instead of rows. */
  padded?: boolean;
}) {
  return (
    <section className={cx("mb-8", className)}>
      {(header || aside) && (
        <div className="mb-2 flex min-h-7 items-end justify-between gap-3 px-1">
          {header && <h2 className="text-title3 font-semibold">{header}</h2>}
          {aside}
        </div>
      )}
      {padded ? (
        <div className="rounded-[0.75rem] bg-cell p-4">{children}</div>
      ) : (
        <ul className="overflow-hidden rounded-[0.75rem] bg-cell">{children}</ul>
      )}
      {footer && <div className="mt-2 px-4 text-footnote text-label-2">{footer}</div>}
    </section>
  );
}

const TILE_COLORS = {
  gold: "bg-tint text-on-tint",
  green: "bg-paid text-white",
  orange: "bg-behind text-white",
  blue: "bg-ahead text-white",
  gray: "bg-[#8d8a85] text-white",
  charcoal: "bg-[#5a5a5a] text-white",
} as const;
export type TileColor = keyof typeof TILE_COLORS;

/** Settings-style rounded square behind a white glyph. */
export function IconTile({
  icon: Icon,
  color = "gray",
  size = "md",
}: {
  icon: LucideIcon;
  color?: TileColor;
  size?: "md" | "lg";
}) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center",
        size === "md" ? "size-[1.875rem] rounded-[0.45rem]" : "size-10 rounded-[0.6rem]",
        TILE_COLORS[color],
      )}
    >
      <Icon className={size === "md" ? "size-[1.1rem]" : "size-6"} strokeWidth={2.2} />
    </span>
  );
}

export function Chevron() {
  return (
    <ChevronRight aria-hidden className="size-[1.1rem] shrink-0 text-label-3" strokeWidth={2.6} />
  );
}

interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  to?: string;
  onClick?: () => void;
  chevron?: boolean;
  /** Action rows: title in the tint colour (or destructive colour). */
  action?: "tint" | "destructive";
  center?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  to,
  onClick,
  chevron,
  action,
  center,
  disabled,
  className,
  ariaLabel,
}: ListRowProps) {
  const interactive = Boolean(to || onClick);
  const showChevron = chevron ?? (interactive && !action);
  const inner = (
    <>
      {leading}
      <span className="row-content flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4">
        <span className={cx("min-w-0 flex-1", center && "text-center")}>
          <span
            className={cx(
              "block text-body",
              action === "tint" && "text-tint-text",
              action === "destructive" && "text-destructive",
            )}
          >
            {title}
          </span>
          {subtitle && <span className="block text-subhead text-label-2">{subtitle}</span>}
        </span>
        {trailing && (
          <span className="flex shrink-0 items-center gap-2 text-right text-body text-label-2">
            {trailing}
          </span>
        )}
        {showChevron && <Chevron />}
      </span>
    </>
  );
  const rowClass = cx(
    "flex w-full items-center gap-3 pl-4 text-left",
    interactive && "transition-colors duration-100 active:bg-highlight",
    disabled && "pointer-events-none opacity-40",
    className,
  );
  return (
    <li className="list-row">
      {to ? (
        <Link to={to} className={rowClass} aria-label={ariaLabel}>
          {inner}
        </Link>
      ) : onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={rowClass}
          disabled={disabled}
          aria-label={ariaLabel}
        >
          {inner}
        </button>
      ) : (
        <div className={rowClass}>{inner}</div>
      )}
    </li>
  );
}

/** Label on the left, value on the right. */
export function ValueRow({
  label,
  value,
  strong,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <ListRow
      title={<span className={cx(strong && "font-semibold")}>{label}</span>}
      trailing={
        <span className={cx("tnum", strong ? "font-semibold text-label" : "text-label-2")}>
          {value}
        </span>
      }
    />
  );
}

/** A list row containing arbitrary content, e.g. a segmented control or a switch. */
export function ListItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <li className="list-row">
      <div className={cx("row-content mx-4 py-3", className)}>{children}</div>
    </li>
  );
}
