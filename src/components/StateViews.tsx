import { useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function PageLoader() {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4" role="status">
      <div className="flex gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-3 animate-pulse rounded-full bg-gold" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
      <p className="text-base text-muted-foreground">Loading…</p>
    </div>
  );
}

export function PageError({ error }: { error: unknown }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center">
      <h1 className="text-2xl font-semibold">This page didn't load</h1>
      <p className="mt-2 text-muted-foreground">
        {error instanceof Error ? error.message : "Something went wrong."}
      </p>
      <Button className="mt-6" onClick={() => router.invalidate()}>
        Try again
      </Button>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-border px-5 py-8 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <div className="mt-1 text-muted-foreground">{children}</div>}
    </div>
  );
}
