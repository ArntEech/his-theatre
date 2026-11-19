import { useSuspenseQuery } from "@tanstack/react-query";
import { Check, Minus, CircleDashed, CircleDot } from "lucide-react";

import { Money } from "@/components/Money";
import { PageHeader, SectionTitle } from "@/components/PageHeader";
import { EmptyState } from "@/components/StateViews";
import { StatusBadge } from "@/components/StatusBadge";
import {
  currentMemberQuery,
  currentSemesterQuery,
  myDuesQuery,
  myMembershipQuery,
  myPaymentsQuery,
  semesterWeeksQuery,
} from "@/data/queries";
import { formatDate, todayISO } from "@/lib/dates";
import { duesStatus } from "@/lib/dues";
import { cn } from "@/lib/utils";
import { ReceiptList } from "./ReceiptList";
import { weekRows, type WeekState } from "./weeks";

const WEEK_TEXT: Record<WeekState, string> = {
  covered: "Paid",
  part: "Part paid",
  unpaid: "Not paid",
  upcoming: "Coming up",
  no_dues: "No dues",
  not_joined: "Before you joined",
  after_leaving: "After you left",
};

export function DuesScreen() {
  const { data: me } = useSuspenseQuery(currentMemberQuery());
  const { data: semester } = useSuspenseQuery(currentSemesterQuery());
  const { data: dues } = useSuspenseQuery(myDuesQuery(semester.id));
  const { data: payments } = useSuspenseQuery(myPaymentsQuery(semester.id));
  const { data: weeks } = useSuspenseQuery(semesterWeeksQuery(semester.id));
  const { data: membership } = useSuspenseQuery(myMembershipQuery(semester.id));

  const today = todayISO();
  const rows = dues ? weekRows(weeks, membership, dues.weeklyRate, dues.paid, today, me?.leftOn ?? null) : [];
  const status = dues ? duesStatus(dues) : null;

  return (
    <div>
      <PageHeader eyebrow={semester.name} title="My dues" action={status ? <StatusBadge status={status} /> : undefined} />

      {dues && (
        <dl className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-card text-center animate-rise">
          <div className="px-2 py-4">
            <dt className="text-muted-foreground">Due so far</dt>
            <dd><Money value={dues.dueSoFar} className="text-2xl font-semibold" /></dd>
          </div>
          <div className="px-2 py-4">
            <dt className="text-muted-foreground">Paid</dt>
            <dd><Money value={dues.paid} className="text-2xl font-semibold" /></dd>
          </div>
          <div className="px-2 py-4">
            <dt className="text-muted-foreground">{dues.credit > 0 ? "Ahead" : "Owing"}</dt>
            <dd>
              <Money
                value={dues.credit > 0 ? dues.credit : dues.owing}
                className={cn("text-2xl font-semibold", dues.owing > 0 && "text-status-behind", dues.credit > 0 && "text-status-ahead")}
              />
            </dd>
          </div>
        </dl>
      )}

      <SectionTitle>Week by week</SectionTitle>
      {rows.length ? (
        <ol className="overflow-hidden rounded-xl border border-border bg-card">
          {rows.map(({ week, state, coveredAmount }) => {
            const isNow = week.weekStart <= today && today < addWeek(week.weekStart);
            return (
              <li
                key={week.id}
                className={cn(
                  "flex min-h-14 items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0",
                  isNow && "bg-accent",
                )}
              >
                <WeekIcon state={state} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    Week {week.weekNo}
                    <span className="font-normal text-muted-foreground"> · {formatDate(week.weekStart, false)}</span>
                    {isNow && <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-sm text-primary-foreground">This week</span>}
                  </p>
                  {week.label && <p className="text-muted-foreground">{week.label}</p>}
                </div>
                <div className="text-right">
                  <p className={cn("font-medium", state === "unpaid" && "text-status-behind", state === "covered" && "text-status-paid")}>
                    {WEEK_TEXT[state]}
                  </p>
                  {state === "part" && <Money value={coveredAmount} className="text-muted-foreground" />}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState title="No weeks to show" />
      )}

      <SectionTitle>Receipts</SectionTitle>
      {payments.length ? <ReceiptList payments={payments} /> : <EmptyState title="No receipts yet" />}
      <p className="mt-3 text-muted-foreground">
        A wrong entry is never deleted. It is reversed with a new receipt, so every cedi stays accounted for.
      </p>
    </div>
  );
}

function addWeek(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

function WeekIcon({ state }: { state: WeekState }) {
  const base = "size-6 shrink-0";
  if (state === "covered") return <Check className={cn(base, "text-status-paid")} aria-hidden strokeWidth={2.5} />;
  if (state === "part") return <CircleDot className={cn(base, "text-gold-deep")} aria-hidden />;
  if (state === "unpaid") return <CircleDashed className={cn(base, "text-status-behind")} aria-hidden />;
  return <Minus className={cn(base, "text-muted-foreground")} aria-hidden />;
}
