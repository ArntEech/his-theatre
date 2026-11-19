import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState, PageLoader } from "@/components/StateViews";
import { auditQuery } from "@/data/queries";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { AdminNav } from "./AdminNav";

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Everything" },
  { value: "payments", label: "Payments" },
  { value: "adjustments", label: "Adjustments" },
  { value: "expenses", label: "Spending" },
  { value: "other_income", label: "Other income" },
  { value: "handovers", label: "Handovers" },
  { value: "members", label: "Members & roles" },
  { value: "dues_rates", label: "Rates" },
  { value: "semester_weeks", label: "Weeks" },
  { value: "semesters", label: "Semesters" },
];

/** Every change to money, rates, weeks and roles. Read-only: nobody can edit this list. */
export function AuditScreen() {
  const [table, setTable] = useState("");
  const { data: rows, isPending } = useQuery({ ...auditQuery(table ? { table } : {}), placeholderData: (prev) => prev });

  return (
    <div>
      <AdminNav />
      <PageHeader eyebrow="Director" title="Audit log" />
      <p className="mb-3 text-muted-foreground">Every change, newest first. Nothing here can be edited or deleted.</p>
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2" role="group" aria-label="Filter by type">
          {FILTERS.map((f) => (
            <button
              key={f.value || "all"}
              type="button"
              aria-pressed={table === f.value}
              onClick={() => setTable(f.value)}
              className={cn(
                "min-h-11 rounded-full border-2 px-4 font-semibold",
                table === f.value ? "border-gold-deep bg-gold text-primary-foreground" : "border-border bg-card",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {isPending && !rows ? (
          <PageLoader />
        ) : rows && rows.length ? (
          <ol className="divide-y divide-border rounded-xl border border-border bg-card">
            {rows.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <p>
                  <span className="font-semibold">
                    {a.actorName}
                    {a.actorPosition ? ` (${a.actorPosition})` : ""}
                  </span>{" "}
                  {a.summary}
                </p>
                <p className="text-sm text-muted-foreground">{formatDateTime(a.createdAt)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="Nothing recorded yet" />
        )}
      </div>
    </div>
  );
}
