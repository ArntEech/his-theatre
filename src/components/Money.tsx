import { formatCedi } from "@/lib/money";
import { cx } from "@/lib/cx";
import type { Pesewas } from "@/data/types";

export function Money({ value, className }: { value: Pesewas; className?: string }) {
  return <span className={cx("tnum whitespace-nowrap", className)}>{formatCedi(value)}</span>;
}

/** The headline figure on a screen, in SF Rounded. Always the largest thing on it. */
export function BigMoney({ value, className }: { value: Pesewas; className?: string }) {
  const text = formatCedi(value);
  const negative = text.startsWith("−");
  const amount = text.slice(negative ? 4 : 3);
  return (
    <span
      className={cx(
        "figure inline-flex items-baseline font-bold leading-none whitespace-nowrap",
        className ?? "text-[clamp(2.75rem,13vw,3.5rem)]",
      )}
    >
      <span className="mr-[0.08em] text-[0.55em] font-semibold">{negative ? "−GH₵" : "GH₵"}</span>
      {amount}
    </span>
  );
}
