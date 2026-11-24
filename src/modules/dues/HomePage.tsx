import { useState } from "react";
import { Link } from "react-router";
import { Banknote, ChevronRight, KeyRound, Smartphone, Sun } from "lucide-react";
import {
  useCurrentMember,
  useCurrentSemester,
  useMyDues,
  useMyPayments,
  useToday,
} from "@/data/queries";
import type { PaymentRow } from "@/data/types";
import { PageHeader } from "@/components/PageHeader";
import { AttendanceGlyph } from "@/components/TabIcons";
import { SummaryCard } from "@/components/Card";
import { IconTile, ListRow, ListSection } from "@/components/List";
import { BigMoney } from "@/components/Money";
import { ContentUnavailable, ErrorNotice, LoadingBlock } from "@/components/States";
import { firstName, isAdmin } from "@/lib/roles";
import { formatDateLong, greeting } from "@/lib/dates";
import { DuesCard } from "./DuesCard";
import { PaymentList } from "./PaymentList";
import { ReceiptSheet } from "./ReceiptSheet";

export function HomePage() {
  const { data: me } = useCurrentMember();
  const semester = useCurrentSemester();
  const dues = useMyDues(semester.data?.id);
  const payments = useMyPayments(semester.data?.id);
  const [receipt, setReceipt] = useState<PaymentRow | null>(null);
  const s = semester.data;

  return (
    <>
      <PageHeader
        overline={s ? formatDateLong(s.today).replace(/ \d{4}$/, "") : undefined}
        title={me ? `${greeting()}, ${firstName(me.fullName)}` : "Summary"}
        large
      />

      {me?.officerPending && <OfficerPinPrompt />}

      {semester.isError && (
        <ErrorNotice error={semester.error} onRetry={() => semester.refetch()} />
      )}
      {dues.isError && <ErrorNotice error={dues.error} onRetry={() => dues.refetch()} />}
      {(semester.isPending || (s && dues.isPending)) && <LoadingBlock />}
      {s === null && (
        <ContentUnavailable
          title="No Semester Yet"
          description="Dues will appear here once a semester is set up."
        />
      )}
      {dues.data === null && (
        <ContentUnavailable
          title="Not on the Roll"
          description={`You're not on the dues roll for ${s?.name}. Speak to the Financial Secretary.`}
        />
      )}

      <div className="mb-8 space-y-4">
        {dues.data && s && (
          <DuesCard
            dues={dues.data}
            to="/dues"
            meta={s.currentWeekNo ? `Week ${s.currentWeekNo} of ${s.weeks.length}` : s.name}
          />
        )}
        {isAdmin(me) && <OfficerCard />}
        <AttendanceCard />
      </div>

      {dues.data && (
        <PaymentList
          header="Recent Receipts"
          aside={
            <Link to="/dues" className="text-body text-tint-text active:opacity-50">
              See All
            </Link>
          }
          payments={(payments.data ?? []).slice(0, 3)}
          onOpen={setReceipt}
          empty="No receipts this semester yet."
        />
      )}

      <ListSection
        header="How to Pay"
        footer="Every payment gets a receipt number, and it appears here straight away."
      >
        <ListRow
          leading={<IconTile icon={Banknote} color="green" />}
          title="Cash"
          subtitle="Hand it to the Financial Secretary at rehearsal."
        />
        <ListRow
          leading={<IconTile icon={Smartphone} color="gold" />}
          title="Mobile Money"
          subtitle="Send it to the ministry number, then show the Financial Secretary the transaction ID."
        />
      </ListSection>

      <ReceiptSheet payment={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}

/** "Today" summary for officers on the Home screen. */
function OfficerCard() {
  const today = useToday();
  if (!today.data) return null;
  const t = today.data;
  const pending = t.pendingHandovers.length;
  return (
    <SummaryCard
      label="Today"
      icon={<Sun aria-hidden className="size-4" strokeWidth={2.4} />}
      meta="Officers"
      to="/admin/today"
    >
      <p className="text-subhead text-label-2">Dues collected</p>
      <BigMoney value={t.duesTotal} className="text-title1" />
      <p className="mt-1 text-subhead text-label-2">
        {t.payments.length} {t.payments.length === 1 ? "receipt" : "receipts"}
        {pending > 0 && ` · ${pending} ${pending === 1 ? "handover" : "handovers"} waiting`}
      </p>
    </SummaryCard>
  );
}

/** Shown to someone made an officer who still has a 4-digit PIN. */
function OfficerPinPrompt() {
  return (
    <Link
      to="/settings/officer-pin"
      className="mb-4 flex items-center gap-3 rounded-[0.9rem] bg-tint/15 p-4 ring-[0.5px] ring-tint/40 transition-opacity active:opacity-70"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-tint text-on-tint">
        <KeyRound aria-hidden className="size-5" strokeWidth={2.3} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline font-semibold">Set Your Officer PIN</span>
        <span className="block text-subhead text-label-2">
          Officers use a 6-digit PIN. Choose yours to open the officer screens.
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-label-3" />
    </Link>
  );
}

/** Attendance lives on Home (it isn't a tab). It's still being built. */
function AttendanceCard() {
  return (
    <Link
      to="/attendance"
      className="flex items-center gap-3 rounded-[1rem] bg-cell p-4 transition-opacity active:opacity-70"
    >
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[0.75rem] bg-tint/18 text-tint-text">
        <AttendanceGlyph filled className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-headline font-semibold">Attendance</span>
          <span className="rounded-full bg-fill px-2 py-0.5 text-caption2 font-semibold text-label-2">
            Soon
          </span>
        </span>
        <span className="block text-subhead text-label-2">
          Check in at Tuesday and Friday rehearsals.
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-label-3" />
    </Link>
  );
}
