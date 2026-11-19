import type { Pesewas } from "@/data/types";

function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Formats an integer number of pesewas as Ghana cedis.
 * "GH₵10" for whole cedis, "GH₵12.50" otherwise.
 */
export function formatCedi(pesewas: Pesewas): string {
  const value = Math.round(pesewas);
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const cedis = Math.floor(abs / 100);
  const rest = abs % 100;
  const whole = groupThousands(cedis);
  return rest === 0 ? `${sign}GH₵${whole}` : `${sign}GH₵${whole}.${String(rest).padStart(2, "0")}`;
}

/**
 * Parses what someone typed into a money field ("12", "12.5", "1,200.50") into pesewas.
 * Uses string arithmetic only, so no floating point ever touches money.
 * Returns null when the text is not a valid amount.
 */
export function parseCedi(input: string): Pesewas | null {
  const text = input.replace(/[,\s]/g, "").replace(/^GH₵/i, "");
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(text);
  if (!match) return null;
  const cedis = Number(match[1]);
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const pesewas = cedis * 100 + Number(fraction);
  return Number.isSafeInteger(pesewas) ? pesewas : null;
}

/** Pesewas to the plain text shown inside an input, e.g. 1250 -> "12.50", 1000 -> "10". */
export function pesewasToInput(pesewas: Pesewas): string {
  const abs = Math.abs(pesewas);
  const rest = abs % 100;
  const cedis = Math.floor(abs / 100);
  return rest === 0 ? String(cedis) : `${cedis}.${String(rest).padStart(2, "0")}`;
}

export function sumPesewas(values: Pesewas[]): Pesewas {
  return values.reduce((total, v) => total + v, 0);
}
