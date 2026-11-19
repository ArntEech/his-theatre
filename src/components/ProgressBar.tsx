import { cx } from "@/lib/cx";

export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-fill", className)}
    >
      <div
        className="h-full rounded-full bg-tint transition-[width] duration-700 ease-[var(--ease-ios)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
