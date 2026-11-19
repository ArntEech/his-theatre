import { useEffect, useState } from "react";
import { useCurrentSemester, useMyDues, useMyPayments, useSemesters } from "@/data/queries";
import type { PaymentRow } from "@/data/types";
import { PageHeader } from "@/components/PageHeader";
import { SelectField } from "@/components/Field";
import { SummaryCard } from "@/components/Card";
import { ListRow, ListSection, ValueRow } from "@/components/List";
import { BigMoney, Money } from "@/components/Money";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { ContentUnavailable, ErrorNotice, LoadingBlock } from "@/components/States";
import { formatCedi } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { PaymentList } from "./PaymentList";
import { ReceiptSheet } from "./ReceiptSheet";
import { Schedule } from "./Schedule";
import { CalendarDays } from "lucide-react";

export function DuesPage() {
  const current = useCurrentSemester();
  const semesters = useSemesters();
  const [semesterId, setSemesterId] = useState<string>();
  useEffect(() => {
    if (!semesterId && current.data) setSemesterId(current.data.id);
  }, [current.data, semesterId]);

  const dues = useMyDues(semesterId);
  const payments = useMyPayments(semesterId);
  const [receipt, setReceipt] = useState<PaymentRow | null>(null);
  const semesterName = semesters.data?.find((s) => s.id === semesterId)?.name ?? current.data?.name;
  const d = dues.data;

  return (
    <>
      <PageHeader overline={semesterName} title="Dues" />

      {semesters.data && semesters.data.length > 1 && (
        <div className="mb-6">
          <SelectField
            label="Semester"
            value={semesterId ?? ""}
            onChange={(e) => setSemesterId(e.target.value)}
          >
            {semesters.data.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isClosed ? " (closed)" : ""}
              </option>
            ))}
          </SelectField>
        </div>
      )}

      {(current.isError || dues.isError) && (
        <ErrorNotice error={current.error ?? dues.error} onRetry={() => dues.refetch()} />
      )}
      {(current.isPending || dues.isPending) && !current.isError && <LoadingBlock lines={5} />}
      {d === null && (
        <ContentUnavailable
          title="Not on the Roll"
          description="You're not on the dues roll for this semester."
        />
      )}

      {d && (
        <>
          <SummaryCard
            label="Paid So Far"
            icon={<CalendarDays aria-hidden className="size-4" strokeWidth={2.4} />}
            meta={<StatusBadge status={d.status} />}
            className="mb-8"
          >
            <BigMoney value={d.paid} />
            <p className="mt-1 mb-4 text-subhead text-label-2">
              of {formatCedi(d.semesterTotal)} for the whole semester
            </p>
            <ProgressBar value={d.progressPct} label="Share of this semester's dues paid" />
          </SummaryCard>

          <ListSection header="Statement">
            <ValueRow label="Weekly rate" value={formatCedi(d.weeklyRate)} />
            <ValueRow
              label={`Weeks due so far (${d.weeksSoFar} of ${d.weeksTotal})`}
              value={formatCedi(d.weeksSoFar * d.weeklyRate)}
            />
            {d.adjustments.length > 0 && (
              <ValueRow
                label="Adjustments"
                value={formatCedi(d.adjustments.reduce((s, a) => s + a.amount, 0))}
              />
            )}
            <ValueRow label="Due so far" value={formatCedi(d.dueSoFar)} />
            <ValueRow label="Paid" value={formatCedi(d.paid)} />
            {d.status === "behind" && (
              <ValueRow
                strong
                label={`Owing · ${d.weeksBehind} ${d.weeksBehind === 1 ? "week" : "weeks"}`}
                value={formatCedi(d.owing)}
              />
            )}
            {d.status === "ahead" && (
              <ValueRow strong label="Paid ahead" value={formatCedi(d.credit)} />
            )}
            {d.status === "paid_up" && <ValueRow strong label="Owing" value={formatCedi(0)} />}
          </ListSection>

          {d.adjustments.length > 0 && (
            <ListSection header="Adjustments">
              {d.adjustments.map((a) => (
                <ListRow
                  key={a.id}
                  title={a.amount < 0 ? "Waiver" : "Extra charge"}
                  subtitle={`${a.reason} · ${a.recordedByName}, ${formatDate(a.createdAt.slice(0, 10))}`}
                  trailing={<Money value={a.amount} className="text-label" />}
                />
              ))}
            </ListSection>
          )}

          <Schedule weeks={d.schedule} today={current.data?.today ?? ""} header="Week by Week" />

          {payments.isPending ? (
            <LoadingBlock lines={2} />
          ) : (
            <PaymentList payments={payments.data ?? []} onOpen={setReceipt} />
          )}
        </>
      )}

      <ReceiptSheet payment={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
