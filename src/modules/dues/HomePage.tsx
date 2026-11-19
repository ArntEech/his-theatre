import { useState } from "react";
import { Link } from "react-router";
import { Banknote, Smartphone, Sun } from "lucide-react";
import {
  useCurrentMember,
  useCurrentSemester,
  useMyDues,
  useMyPayments,
  useToday,
} from "@/data/queries";
import type { PaymentRow } from "@/data/types";
import { PageHeader } from "@/components/PageHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
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
        action={<ThemeToggle />}
      />

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
