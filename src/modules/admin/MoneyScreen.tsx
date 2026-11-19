import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Plus, RotateCcw } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ChoiceGroup, Field, MoneyInput, selectClass } from "@/components/Field";
import { FormSheet } from "@/components/FormSheet";
import { Money } from "@/components/Money";
import { PageHeader, SectionTitle } from "@/components/PageHeader";
import { EmptyState } from "@/components/StateViews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as api from "@/data/api";
import { cashPositionQuery, currentMemberQuery, expensesQuery, handoversQuery, incomeQuery, officersQuery } from "@/data/queries";
import type { Expense, IncomeSource, OtherIncome, PaymentMethod } from "@/data/types";
import { formatDate, formatDateTime, todayISO } from "@/lib/dates";
import { EXPENSE_CATEGORIES, INCOME_SOURCE_LABEL, METHOD_LABEL } from "@/lib/labels";
import { formatCedi, parseCedi } from "@/lib/money";
import { useApiMutation } from "@/lib/use-api-mutation";
import { cn } from "@/lib/utils";
import { AdminNav } from "./AdminNav";
import { ReasonSheet } from "./ReasonSheet";

type Tab = "out" | "in" | "handover";

export function MoneyScreen() {
  const [tab, setTab] = useState<Tab>("out");
  return (
    <div>
      <AdminNav />
      <PageHeader eyebrow="Admin" title="In / Out" />
      <ChoiceGroup<Tab>
        name="Section"
        value={tab}
        onChange={setTab}
        options={[
          { value: "out", label: "Money out" },
          { value: "in", label: "Money in" },
          { value: "handover", label: "Handover" },
        ]}
      />
      <div className="mt-5">
        {tab === "out" && <ExpensesSection />}
        {tab === "in" && <IncomeSection />}
        {tab === "handover" && <HandoverSection />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Money out
// ---------------------------------------------------------------------------

function ExpensesSection() {
  const { data: rows } = useSuspenseQuery(expensesQuery());
  const [adding, setAdding] = useState(false);
  const [reversing, setReversing] = useState<Expense | null>(null);
  const reverse = useApiMutation((v: { id: string; reason: string }) => api.reverseExpense(v.id, v.reason), {
    success: "Expense reversed. The original stays on record.",
    onSuccess: () => setReversing(null),
  });
  const reversedIds = new Set(rows.map((r) => r.reversesId).filter(Boolean));

  return (
    <>
      <Button size="lg" className="w-full" onClick={() => setAdding(true)}>
        <Plus aria-hidden /> Record money out
      </Button>
      <SectionTitle>Spending</SectionTitle>
      {rows.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {[...rows]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((e) => (
              <Row
                key={e.id}
                refNo={e.ref}
                title={e.description}
                meta={`${e.category} · ${formatDate(e.date)} · approved by ${e.approvedBy}${e.receiptRef ? ` · receipt ${e.receiptRef}` : ""}`}
                amount={-Math.abs(e.amount) * (e.reversesId ? -1 : 1)}
                isReversal={Boolean(e.reversesId)}
                reversed={reversedIds.has(e.id)}
                onReverse={() => setReversing(e)}
              />
            ))}
        </ul>
      ) : (
        <EmptyState title="No spending recorded yet" />
      )}
      {adding && <ExpenseSheet onClose={() => setAdding(false)} />}
      <ReasonSheet
        open={reversing !== null}
        onOpenChange={(o) => !o && setReversing(null)}
        title={reversing ? `Reverse ${reversing.ref}?` : "Reverse"}
        description="This adds a correcting entry. The original stays on record."
        confirmLabel="Reverse expense"
        busy={reverse.isPending}
        onConfirm={(reason) => reversing && reverse.mutate({ id: reversing.id, reason })}
      />
    </>
  );
}

function ExpenseSheet({ onClose }: { onClose: () => void }) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0] ?? "Other");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [date, setDate] = useState(todayISO());
  const pesewas = parseCedi(amount);
  const mutation = useApiMutation(api.recordExpense, { success: (e) => `${e.ref} saved: ${formatCedi(e.amount)}`, onSuccess: onClose });
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!pesewas) return;
    mutation.mutate({ description, category, amount: pesewas, paidBy, approvedBy, ...(receiptRef.trim() ? { receiptRef } : {}), date });
  }
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Money out" description="Anything the ministry spent.">
      <form onSubmit={submit} className="space-y-4">
        <Field id="ex-desc" label="What was it for?">
          <Input id="ex-desc" value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={120} />
        </Field>
        <Field id="ex-cat" label="Category">
          <select id="ex-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field id="ex-amount" label="Amount">
          <MoneyInput id="ex-amount" value={amount} onChange={setAmount} />
        </Field>
        <Field id="ex-paid" label="Paid by">
          <Input id="ex-paid" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} required maxLength={80} />
        </Field>
        <Field id="ex-approved" label="Approved by">
          <Input id="ex-approved" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} required maxLength={80} />
        </Field>
        <Field id="ex-receipt" label="Receipt reference (optional)">
          <Input id="ex-receipt" value={receiptRef} onChange={(e) => setReceiptRef(e.target.value)} maxLength={80} />
        </Field>
        <Field id="ex-date" label="Date">
          <Input id="ex-date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={!pesewas || mutation.isPending}>
          {mutation.isPending ? "Saving…" : pesewas ? `Save ${formatCedi(pesewas)} spent` : "Save"}
        </Button>
      </form>
    </FormSheet>
  );
}

// ---------------------------------------------------------------------------
// Money in (not dues)
// ---------------------------------------------------------------------------

const SOURCES = Object.keys(INCOME_SOURCE_LABEL) as IncomeSource[];

function IncomeSection() {
  const { data: rows } = useSuspenseQuery(incomeQuery());
  const [adding, setAdding] = useState(false);
  const [reversing, setReversing] = useState<OtherIncome | null>(null);
  const reverse = useApiMutation((v: { id: string; reason: string }) => api.reverseIncome(v.id, v.reason), {
    success: "Entry reversed. The original stays on record.",
    onSuccess: () => setReversing(null),
  });
  const reversedIds = new Set(rows.map((r) => r.reversesId).filter(Boolean));

  return (
    <>
      <Button size="lg" className="w-full" onClick={() => setAdding(true)}>
        <Plus aria-hidden /> Record money in
      </Button>
      <p className="mt-2 text-muted-foreground">Donations, offerings, ticket sales, fundraising and levies. Dues go in Members.</p>
      <SectionTitle>Other income</SectionTitle>
      {rows.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {[...rows]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((i) => (
              <Row
                key={i.id}
                refNo={i.ref}
                title={i.description || INCOME_SOURCE_LABEL[i.source]}
                meta={`${INCOME_SOURCE_LABEL[i.source]} · ${METHOD_LABEL[i.method]} · ${formatDate(i.date)}`}
                amount={i.amount}
                isReversal={Boolean(i.reversesId)}
                reversed={reversedIds.has(i.id)}
                onReverse={() => setReversing(i)}
              />
            ))}
        </ul>
      ) : (
        <EmptyState title="No other income recorded yet" />
      )}
      {adding && <IncomeSheet onClose={() => setAdding(false)} />}
      <ReasonSheet
        open={reversing !== null}
        onOpenChange={(o) => !o && setReversing(null)}
        title={reversing ? `Reverse ${reversing.ref}?` : "Reverse"}
        description="This adds a correcting entry. The original stays on record."
        confirmLabel="Reverse entry"
        busy={reverse.isPending}
        onConfirm={(reason) => reversing && reverse.mutate({ id: reversing.id, reason })}
      />
    </>
  );
}

function IncomeSheet({ onClose }: { onClose: () => void }) {
  const [source, setSource] = useState<IncomeSource>("donation");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(todayISO());
  const pesewas = parseCedi(amount);
  const mutation = useApiMutation(api.recordIncome, { success: (i) => `${i.ref} saved: ${formatCedi(i.amount)}`, onSuccess: onClose });
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!pesewas) return;
    mutation.mutate({ source, description, amount: pesewas, method, date });
  }
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Money in" description="Money that isn't dues.">
      <form onSubmit={submit} className="space-y-4">
        <Field id="in-source" label="Where it came from">
          <select id="in-source" value={source} onChange={(e) => setSource(e.target.value as IncomeSource)} className={selectClass}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {INCOME_SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="in-desc" label="Description" hint='For example "Azusa levy" or "Sunday offering".'>
          <Input id="in-desc" value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={120} />
        </Field>
        <Field id="in-amount" label="Amount">
          <MoneyInput id="in-amount" value={amount} onChange={setAmount} />
        </Field>
        <Field id="in-method" label="Received by">
          <ChoiceGroup<PaymentMethod>
            name="Received by"
            value={method}
            onChange={setMethod}
            options={[
              { value: "cash", label: "Cash" },
              { value: "momo", label: "MoMo" },
            ]}
          />
        </Field>
        <Field id="in-date" label="Date">
          <Input id="in-date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={!pesewas || mutation.isPending}>
          {mutation.isPending ? "Saving…" : pesewas ? `Save ${formatCedi(pesewas)} received` : "Save"}
        </Button>
      </form>
    </FormSheet>
  );
}

// ---------------------------------------------------------------------------
// Handover: Financial Secretary → Treasurer
// ---------------------------------------------------------------------------

function HandoverSection() {
  const { data: me } = useSuspenseQuery(currentMemberQuery());
  const { data: cash } = useSuspenseQuery(cashPositionQuery());
  const { data: officers } = useSuspenseQuery(officersQuery());
  const { data: handovers } = useSuspenseQuery(handoversQuery());
  const treasurer = officers.find((o) => o.position === "Treasurer");
  const nameOf = (id: string) => officers.find((o) => o.id === id)?.fullName ?? "Unknown";
  const myCash = cash.holders.find((h) => h.memberId === me?.id)?.cash ?? 0;
  const [amount, setAmount] = useState("");
  const pesewas = parseCedi(amount);

  const record = useApiMutation(api.recordHandover, {
    success: (h) => `${h.ref}: ${formatCedi(h.amount)} handed over. Waiting for the Treasurer to confirm.`,
    onSuccess: () => setAmount(""),
  });
  const confirm = useApiMutation(api.confirmHandover, { success: (h) => `Confirmed ${formatCedi(h.amount)} received (${h.ref})` });

  return (
    <>
      <div className="rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {cash.holders.map((h) => (
            <li key={h.memberId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-semibold">{h.fullName}</p>
                <p className="text-muted-foreground">{h.position ?? "Officer"} · cash in hand</p>
              </div>
              <Money value={h.cash} className="text-xl font-semibold" />
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="font-semibold">Handed over, awaiting confirmation</p>
            <Money value={cash.inTransit} className={cn("text-xl font-semibold", cash.inTransit > 0 && "text-status-behind")} />
          </li>
        </ul>
      </div>

      {me?.position === "Financial Secretary" && treasurer && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pesewas) record.mutate({ toMemberId: treasurer.id, amount: pesewas });
          }}
          className="mt-5 space-y-3 rounded-xl border-2 border-gold-deep bg-accent p-4"
        >
          <p className="font-display text-lg font-semibold">Hand cash to {treasurer.fullName}</p>
          <Field id="ho-amount" label="Amount" hint={`You hold ${formatCedi(myCash)} in cash.`}>
            <MoneyInput id="ho-amount" value={amount} onChange={setAmount} />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={!pesewas || record.isPending}>
            {record.isPending ? "Saving…" : pesewas ? `Record handing over ${formatCedi(pesewas)}` : "Record handover"}
          </Button>
          <p className="text-sm text-muted-foreground">The money stays counted as yours until the Treasurer confirms receiving it.</p>
        </form>
      )}

      <SectionTitle>Handovers</SectionTitle>
      {handovers.length ? (
        <ul className="space-y-3">
          {handovers.map((h) => (
            <li key={h.id} className={cn("rounded-xl border p-4", h.confirmedAt ? "border-border bg-card" : "border-2 border-gold-deep bg-accent")}>
              <div className="flex items-start gap-3">
                <ArrowRightLeft className="mt-1 size-5 text-gold-deep" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {nameOf(h.fromMemberId)} → {nameOf(h.toMemberId)}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="num">{h.ref}</span> · {formatDateTime(h.recordedAt)}
                  </p>
                  <p className={cn("font-medium", h.confirmedAt ? "text-status-paid" : "text-status-behind")}>
                    {h.confirmedAt ? `Confirmed ${formatDateTime(h.confirmedAt)}` : "Waiting for confirmation"}
                  </p>
                </div>
                <Money value={h.amount} className="text-xl font-semibold" />
              </div>
              {!h.confirmedAt && h.toMemberId === me?.id && (
                <Button className="mt-3 w-full" disabled={confirm.isPending} onClick={() => confirm.mutate(h.id)}>
                  Confirm I received {formatCedi(h.amount)}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No handovers yet" />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function Row({
  refNo,
  title,
  meta,
  amount,
  isReversal,
  reversed,
  onReverse,
}: {
  refNo: string;
  title: string;
  meta: string;
  amount: number;
  isReversal: boolean;
  reversed: boolean;
  onReverse: () => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          <span className="num mr-2">{refNo}</span>
          {title}
        </p>
        <p className="text-muted-foreground">{meta}</p>
        {isReversal && (
          <p className="mt-0.5 flex items-center gap-1.5 font-medium text-status-behind">
            <RotateCcw className="size-4" aria-hidden /> Correcting entry
          </p>
        )}
        {reversed && <p className="mt-0.5 font-medium text-status-behind">Reversed</p>}
        {!isReversal && !reversed && (
          <button type="button" onClick={onReverse} className="mt-1 min-h-11 font-semibold text-status-behind underline underline-offset-4">
            Reverse
          </button>
        )}
      </div>
      <Money value={amount} className={cn("text-lg font-semibold", reversed && "line-through opacity-60")} />
    </li>
  );
}
