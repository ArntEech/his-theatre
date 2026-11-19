import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function MoneyInput({ id, value, onChange, autoFocus }: { id: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <span className="num pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">GH₵</span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="num flex min-h-14 w-full rounded-lg border-2 border-input bg-paper pl-16 pr-3.5 text-2xl focus-visible:border-gold-deep focus-visible:outline-none"
      />
    </div>
  );
}

export const selectClass =
  "flex min-h-12 w-full rounded-lg border-2 border-input bg-paper px-3 text-base focus-visible:border-gold-deep focus-visible:outline-none";

export function ChoiceGroup<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-flow-col auto-cols-fr gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="min-h-12 rounded-lg border-2 border-input bg-paper px-3 font-semibold transition-colors aria-checked:border-gold-deep aria-checked:bg-gold aria-checked:text-primary-foreground"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
