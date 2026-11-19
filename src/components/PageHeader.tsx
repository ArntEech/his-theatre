import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3 animate-rise">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="programme-rule mb-3 mt-8 flex items-center justify-between gap-3 pt-3">
      <h2 className="text-xl font-semibold">{children}</h2>
      {action}
    </div>
  );
}
