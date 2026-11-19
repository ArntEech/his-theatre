import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { isDemo } from "@/lib/env";

/** App identity above every sign-in form. */
export function AuthCover({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mt-2 mb-8 flex flex-col items-center text-center">
      <Logo className="mb-5 w-[5.5rem]" />
      <h1 className="text-title1 font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1.5 max-w-[19rem] text-callout text-label-2">{subtitle}</p>}
    </div>
  );
}

/** Test credentials, shown in development builds only. */
export function DevHint({ children }: { children: ReactNode }) {
  if (!isDemo) return null;
  return (
    <aside className="mt-8 rounded-[0.75rem] bg-fill p-4 text-footnote">
      <p className="mb-1 font-semibold">Test accounts · demo data only</p>
      <div className="space-y-1 text-label-2">{children}</div>
    </aside>
  );
}

export const authLink =
  "inline-flex min-h-11 items-center justify-center text-body text-tint-text active:opacity-50";
