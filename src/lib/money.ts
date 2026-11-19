import type { Pesewas } from "@/data/types";

/** "GH₵10" for whole cedis, "GH₵12.50" otherwise. Negative values get a leading minus. */
export function formatCedi(pesewas: Pesewas): string {
  const sign = pesewas < 0 ? "−" : "";
  const abs = Math.abs(Math.round(pesewas));
  const cedis = Math.floor(abs / 100);
  const rest = abs % 100;
  const whole = cedis.toLocaleString("en-GH");
  return rest === 0
    ? `${sign}GH₵${whole}`
    : `${sign}GH₵${whole}.${String(rest).padStart(2, "0")}`;
}

/** Turn what an officer types ("12.5", "12", "GH₵ 1,200.00") into pesewas, or null if invalid. */
export function parseCedi(input: string): Pesewas | null {
  const cleaned = input.replace(/GH₵|GHS|,|\s/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
