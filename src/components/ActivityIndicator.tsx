import { cx } from "@/lib/cx";

/** The iOS activity indicator: eight spokes fading in turn. Inherits the text colour. */
export function ActivityIndicator({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      className={cx("activity", className)}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${-0.8 + i * 0.1}s` }}
        />
      ))}
    </span>
  );
}
