import { useState } from "react";
import { ArrowLeftRight, HandCoins, Plus, Sun, Wallet } from "lucide-react";
import { useCurrentMember, useToday } from "@/data/queries";
import type { PaymentRow } from "@/data/types";
import { INCOME_SOURCE_LABELS } from "@/data/types";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/Button";
import { SummaryCard } from "@/components/Card";
import { ListSection, ValueRow } from "@/components/List";
import { BigMoney } from "@/components/Money";
import { ErrorNotice, LoadingBlock } from "@/components/States";
import { formatCedi } from "@/lib/money";
import { formatDateLong } from "@/lib/dates";
import { PaymentList } from "@/modules/dues/PaymentList";
import { AdminReceiptSheet } from "./components/AdminReceiptSheet";
import { EntryList } from "./components/EntryList";
import { PendingHandovers } from "./components/PendingHandovers";

export function TodayPage() {
  const today = useToday();
  const { data: me } = useCurrentMember();
  const [receipt, setReceipt] = useState<PaymentRow | null>(null);
  const t = today.data;

  return (
    <>
      <PageHeader
        back={{ to: "/admin", label: "Admin" }}
        overline={t ? formatDateLong(t.date) : undefined}
        title="Today"
      />
      {today.isError && <ErrorNotice error={today.error} onRetry={() => today.refetch()} />}
      {today.isPending && <LoadingBlock lines={5} />}
      {t && (
        <>
          <SummaryCard
            label="Money In Today"
            icon={<Sun aria-hidden className="size-4" strokeWidth={2.4} />}
            className="mb-4"
          >
            <BigMoney value={t.net} />
            <p className="mt-1 text-subhead text-label-2">
              {t.payments.length} {t.payments.length === 1 ? "receipt" : "receipts"} · dues, other
              income and expenses combined
            </p>
          </SummaryCard>

          <div className="mb-8 grid grid-cols-3 gap-2">
            <ButtonLink
              to="/admin/pay"
              size="medium"
              className="flex-col gap-1 py-2.5"
              icon={<Plus aria-hidden className="size-5" strokeWidth={2.4} />}
            >
              Payment
            </ButtonLink>
            <ButtonLink
              to="/admin/expenses?new=1"
              variant="gray"
              size="medium"
              className="flex-col gap-1 py-2.5"
              icon={<Wallet aria-hidden className="size-5" />}
            >
              Expense
            </ButtonLink>
            <ButtonLink
              to="/admin/income?new=1"
              variant="gray"
              size="medium"
              className="flex-col gap-1 py-2.5"
              icon={<HandCoins aria-hidden className="size-5" />}
            >
              Income
            </ButtonLink>
          </div>

          <ListSection header="Breakdown">
            <ValueRow label="Dues in cash" value={formatCedi(t.duesCash)} />
            <ValueRow label="Dues by MoMo" value={formatCedi(t.duesMomo)} />
            <ValueRow label="Other income" value={formatCedi(t.incomeTotal)} />
            <ValueRow label="Expenses" value={formatCedi(-t.expensesTotal)} />
            <ValueRow strong label="Net" value={formatCedi(t.net)} />
          </ListSection>

          <SummaryCard
            label="Cash in Your Hands"
            icon={<HandCoins aria-hidden className="size-4" strokeWidth={2.4} />}
            accent="text-paid-text"
            className="mb-8"
          >
            <BigMoney value={t.myCashHolding} className="text-title1" />
            <p className="mt-1 text-subhead text-label-2">
              Cash you collected or received, less what you handed over or spent.
            </p>
            {t.myCashHolding > 0 && (
              <ButtonLink
                to="/admin/handovers"
                variant="tinted"
                size="medium"
                block
                className="mt-4"
                icon={<ArrowLeftRight aria-hidden className="size-4" />}
              >
                Hand Over Cash
              </ButtonLink>
            )}
          </SummaryCard>

          <PendingHandovers handovers={t.pendingHandovers} meId={me?.id} />

          <PaymentList
            header="Receipts"
            payments={t.payments}
            onOpen={setReceipt}
            showMember
            empty="No dues recorded yet today."
          />

          {(t.income.length > 0 || t.expenses.length > 0) && (
            <EntryList
              header="Other Money"
              empty=""
              items={[
                ...t.income.map((i) => ({
                  id: i.id,
                  title: i.description,
                  meta: `${i.ref} · ${INCOME_SOURCE_LABELS[i.source]}`,
                  amount: i.amount,
                  voided: Boolean(i.voidedBy),
                  icon: HandCoins,
                  color: "green" as const,
                })),
                ...t.expenses.map((e) => ({
                  id: e.id,
                  title: e.description,
                  meta: `${e.ref} · ${e.category}`,
                  amount: -e.amount,
                  voided: Boolean(e.voidedBy),
                  icon: Wallet,
                  color: "orange" as const,
                })),
              ]}
            />
          )}
        </>
      )}
      <AdminReceiptSheet payment={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
