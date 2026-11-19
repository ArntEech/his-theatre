import { useMemo, useState } from "react";
import { useAudit } from "@/data/queries";
import type { AuditEntry } from "@/data/types";
import { PageHeader } from "@/components/PageHeader";
import { SearchField } from "@/components/Field";
import { ListRow, ListSection } from "@/components/List";
import { ContentUnavailable, ErrorNotice, LoadingBlock } from "@/components/States";
import { formatDateLong, formatTime, localToday } from "@/lib/dates";
import { cx } from "@/lib/cx";

const TABLES = [
  { value: "", label: "All" },
  { value: "payments", label: "Payments" },
  { value: "adjustments", label: "Adjustments" },
  { value: "expenses", label: "Expenses" },
  { value: "other_income", label: "Income" },
  { value: "handovers", label: "Handovers" },
  { value: "members", label: "Members" },
  { value: "semesters", label: "Semesters" },
];

export function AuditPage() {
  const [table, setTable] = useState("");
  const [search, setSearch] = useState("");
  const audit = useAudit({ table: table || undefined, search: search || undefined });

  // Group entries by day, newest first, like Wallet's transaction history.
  const days = useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const a of audit.data ?? []) {
      const day = localToday(new Date(a.createdAt));
      map.set(day, [...(map.get(day) ?? []), a]);
    }
    return [...map.entries()];
  }, [audit.data]);

  return (
    <>
      <PageHeader back={{ to: "/admin", label: "Admin" }} title="Audit Log" />
      <div className="mb-6 flex flex-col gap-3">
        <SearchField
          value={search}
          onChange={setSearch}
          label="Search the audit log"
          placeholder="Name, receipt or word"
        />
        <div
          role="group"
          aria-label="Show"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:px-0"
        >
          {TABLES.map((t) => (
            <button
              key={t.value || "all"}
              type="button"
              aria-pressed={table === t.value}
              onClick={() => setTable(t.value)}
              className={cx(
                "min-h-11 shrink-0 rounded-full px-4 text-subhead font-semibold whitespace-nowrap transition-colors",
                table === t.value
                  ? "bg-tint text-on-tint"
                  : "bg-fill text-label active:bg-fill-strong",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="px-1 text-footnote text-label-2">
          Every change, by whom and when. Entries can never be edited or removed.
        </p>
      </div>
      {audit.isError && <ErrorNotice error={audit.error} onRetry={() => audit.refetch()} />}
      {audit.isPending && <LoadingBlock lines={6} />}
      {audit.data?.length === 0 && (
        <ContentUnavailable title="No Results" description="No entries match." />
      )}
      {days.map(([day, entries]) => (
        <ListSection
          key={day}
          header={<span className="text-headline">{formatDateLong(day)}</span>}
        >
          {entries.map((a) => (
            <ListRow
              key={a.id}
              title={<span className="font-semibold">{a.action}</span>}
              subtitle={
                <>
                  <span className="block break-words text-label">{a.summary}</span>
                  <span className="block">
                    {a.actorName}
                    {a.actorPosition ? `, ${a.actorPosition}` : ""}
                  </span>
                </>
              }
              trailing={
                <span className="tnum self-start pt-0.5 text-footnote">
                  {formatTime(a.createdAt)}
                </span>
              }
            />
          ))}
        </ListSection>
      ))}
    </>
  );
}
