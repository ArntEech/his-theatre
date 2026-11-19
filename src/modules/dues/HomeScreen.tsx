import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { Money } from "@/components/Money";
import { SectionTitle } from "@/components/PageHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState } from "@/components/StateViews";
import { StatusBadge, statusTextClass } from "@/components/StatusBadge";
import { currentMemberQuery, currentSemesterQuery, myDuesQuery, myPaymentsQuery } from "@/data/queries";
import type { DuesSummary } from "@/data/types";
import { duesStatus } from "@/lib/dues";
import { firstName, isAdmin } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { ReceiptList } from "./ReceiptList";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function HomeScreen() {
  const { data: me } = useSuspenseQuery(currentMemberQuery());
  const { data: semester } = useSuspenseQuery(currentSemesterQuery());
  const { data: dues } = useSuspenseQuery(myDuesQuery(semester.id));
  const { data: payments } = useSuspenseQuery(myPaymentsQuery(semester.id));

  if (!me) return null;

  return (
    <div>
      <div className="animate-rise">
        <p className="eyebrow">{greeting()}</p>
        <h1 className="mt-1 text-3xl font-semibold">{firstName(me.fullName)}</h1>
      </div>

      {dues ? <DuesTicket dues={dues} semesterName={semester.name} /> : (
        <div className="mt-6">
          <EmptyState title="No dues this semester">You're not on the dues list for {semester.name}.</EmptyState>
        </div>
      )}

      {isAdmin(me) && (
        <Link
          to="/admin"
          className="mt-4 flex min-h-14 items-center justify-between rounded-xl bg-stage px-4 text-stage-foreground"
        >
          <span>
            <span className="block font-semibold">{me.position ?? "Admin"} desk</span>
            <span className="text-stage-foreground/80">Today's money, members and reports</span>
          </span>
          <ChevronRight className="size-6 text-gold" aria-hidden />
        </Link>
      )}

      <SectionTitle
        action={
          payments.length > 0 ? (
            <Link to="/dues" className="font-semibold text-gold-text underline decoration-gold-deep underline-offset-4">
              All receipts
            </Link>
          ) : undefined
        }
      >
        Recent receipts
      </SectionTitle>
      {payments.length ? (
        <ReceiptList payments={payments.slice(0, 3)} />
      ) : (
        <EmptyState title="No receipts yet">Pay the Financial Secretary in cash or by MoMo and your receipt will show here.</EmptyState>
      )}
    </div>
  );
}

function DuesTicket({ dues, semesterName }: { dues: DuesSummary; semesterName: string }) {
  const status = duesStatus(dues);
  const label = status === "behind" ? "You owe" : status === "ahead" ? "Paid ahead by" : "You're paid up";
  const big = status === "behind" ? dues.owing : status === "ahead" ? dues.credit : dues.paid;

  return (
    <section className="ticket spotlight mt-6 overflow-hidden animate-rise" aria-label="Your dues">
      <div className="px-5 pb-6 pt-5">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow">{semesterName}</p>
          <p className="text-muted-foreground">
            Week <span className="num">{dues.weeksSoFar}</span> of <span className="num">{dues.weeksTotal}</span>
          </p>
        </div>
        <p className="mt-5 text-lg font-medium">{label}</p>
        <Money value={big} className={cn("block text-6xl font-semibold leading-none sm:text-7xl", status !== "paid_up" && statusTextClass[status])} />
        {status === "paid_up" && <p className="mt-2 text-muted-foreground">paid so far this semester</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          {status === "behind" && (
            <span className="font-medium">
              {dues.weeksBehind} {dues.weeksBehind === 1 ? "week" : "weeks"} behind
            </span>
          )}
        </div>
      </div>
      <div className="ticket-tear mx-0" />
      <div className="space-y-2.5 px-5 pb-5 pt-5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">
            <Money value={dues.paid} /> of <Money value={dues.semesterTotal} /> paid
          </span>
          <span className="num text-muted-foreground">{Math.round(dues.progressPct)}%</span>
        </div>
        <ProgressBar value={dues.progressPct} label="Semester dues paid" />
        <p className="text-muted-foreground">
          <Money value={dues.weeklyRate} /> a week · <Money value={dues.dueSoFar} /> due so far
        </p>
      </div>
    </section>
  );
}
