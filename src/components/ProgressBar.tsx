import { cn } from "@/lib/utils";

export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-3 w-full overflow-hidden rounded-full bg-muted ring-1 ring-border", className)}
    >
      <div className="h-full rounded-full bg-gold transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}
