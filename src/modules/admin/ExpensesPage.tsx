import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { Plus, Undo2, Wallet } from "lucide-react";
import { recordExpense, reverseExpense } from "@/data/api";
import { useApiMutation, useCurrentMember, useReport } from "@/data/queries";
import { EXPENSE_CATEGORIES, type ExpenseRow } from "@/data/types";
import { PageHeader } from "@/components/PageHeader";
import { Button, IconButton } from "@/components/Button";
import { MoneyField, SelectField, TextField } from "@/components/Field";
import { SummaryCard } from "@/components/Card";
import { ListRow, ListSection, ValueRow } from "@/components/List";
import { BigMoney } from "@/components/Money";
import { Sheet } from "@/components/Sheet";
import { ErrorNotice, InlineError, LoadingBlock } from "@/components/States";
import { useFlash } from "@/components/Flash";
import { formatCedi, parseCedi } from "@/lib/money";
import { formatDate, formatDateTime, formatDay } from "@/lib/dates";
import { EntryList } from "./components/EntryList";
import { VoidSheet } from "./components/VoidSheet";
import { useSemesterRange } from "./useSemesterRange";

export function ExpensesPage() {
  const [params, setParams] = useSearchParams();
  const { semester, from, to } = useSemesterRange();
  const report = useReport(from, to);
  const [openId, setOpenId] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<ExpenseRow | null>(null);
  const flash = useFlash();
  const reverse = useApiMutation(reverseExpense);
  const formOpen = params.get("new") === "1";
  const rows = report.data?.expenseRows ?? [];
  const open = rows.find((r) => r.id === openId) ?? null;

  function setFormOpen(v: boolean) {
    const next = new URLSearchParams(params);
    if (v) next.set("new", "1");
    else next.delete("new");
    setParams(next, { replace: true });
  }

  return (
    <>
      <PageHeader
        back={{ to: "/admin", label: "Admin" }}
        overline={semester.data?.name}
        title="Expenses"
        action={
          <IconButton label="Record an expense" onClick={() => setFormOpen(true)}>
            <Plus aria-hidden className="size-6" strokeWidth={2.2} />
          </IconButton>
        }
      />
      {report.isError && <ErrorNotice error={report.error} onRetry={() => report.refetch()} />}
      {(semester.isPending || report.isPending) && <LoadingBlock lines={4} />}
      {report.data && (
        <>
          <SummaryCard
            label="Spent This Semester"
            icon={<Wallet aria-hidden className="size-4" strokeWidth={2.4} />}
            accent="text-behind-text"
            className="mb-4"
          >
            <BigMoney value={report.data.expenses.total} />
            <p className="mt-1 text-subhead text-label-2">
              {formatDate(from)} to {formatDate(to)}
            </p>
          </SummaryCard>
          <Button
            block
            className="mb-8"
            icon={<Plus aria-hidden className="size-5" strokeWidth={2.4} />}
            onClick={() => setFormOpen(true)}
          >
            Record Expense
          </Button>
          {report.data.expenses.byCategory.length > 0 && (
            <ListSection header="By Category">
              {report.data.expenses.byCategory.map((c) => (
                <ValueRow key={c.category} label={c.category} value={formatCedi(c.amount)} />
              ))}
            </ListSection>
          )}
          <EntryList
            header="All Expenses"
            empty="No expenses recorded this semester."
            onOpen={setOpenId}
            items={rows.map((e) => ({
              id: e.id,
              title: e.reversesRef ? `Void of ${e.reversesRef}` : e.description,
              meta: `${e.ref} · ${formatDay(e.date)} · ${e.category}`,
              amount: e.amount,
              voided: Boolean(e.voidedBy),
              icon: e.reversesRef ? Undo2 : Wallet,
              color: "orange",
            }))}
          />
        </>
      )}

      <ExpenseForm open={formOpen} onClose={() => setFormOpen(false)} today={to} />

      <Sheet open={Boolean(open)} onClose={() => setOpenId(null)} title={open?.ref ?? ""}>
        {open && (
          <>
            <div className="mb-6 flex flex-col items-center text-center">
              <BigMoney value={open.amount} className="text-[3rem]" />
              <p className="mt-2 text-headline font-semibold">
                {open.reversesRef ? `Void of ${open.reversesRef}` : open.description}
              </p>
            </div>
            {open.voidedBy && (
              <div className="mb-4">
                <InlineError error={new Error(`Voided by ${open.voidedBy}.`)} />
              </div>
            )}
            <ListSection className="mb-4">
              {open.reversesRef && <ValueRow label="Reason" value={open.description} />}
              <ValueRow label="Category" value={open.category} />
              <ValueRow label="Date" value={formatDate(open.date)} />
              <ValueRow label="Paid by" value={open.paidBy} />
              <ValueRow label="Approved by" value={open.approvedBy} />
              {open.receiptRef && <ValueRow label="Receipt" value={open.receiptRef} />}
              <ValueRow
                label="Recorded"
                value={`${open.recordedByName}, ${formatDateTime(open.createdAt)}`}
              />
            </ListSection>
            {!open.voidedBy && !open.reversesRef && (
              <ListSection footer="Voiding records a reversal. Nothing is deleted.">
                <ListRow
                  action="destructive"
                  center
                  title="Void This Expense"
                  onClick={() => {
                    setVoiding(open);
                    setOpenId(null);
                  }}
                />
              </ListSection>
            )}
          </>
        )}
      </Sheet>

      <VoidSheet
        open={Boolean(voiding)}
        onClose={() => {
          reverse.reset();
          setVoiding(null);
        }}
        subject={voiding ? `${voiding.ref} · ${voiding.description}` : ""}
        amount={voiding?.amount ?? 0}
        pending={reverse.isPending}
        error={reverse.error}
        onConfirm={async (reason) => {
          const r = await reverse.mutateAsync([voiding!.id, reason]);
          flash(`${voiding!.ref} voided. Reversal ${r.ref} recorded.`, "success");
          setVoiding(null);
        }}
      />
    </>
  );
}

function ExpenseForm({
  open,
  onClose,
  today,
}: {
  open: boolean;
  onClose: () => void;
  today: string;
}) {
  const flash = useFlash();
  const { data: me } = useCurrentMember();
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amountText, setAmountText] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [date, setDate] = useState("");
  const record = useApiMutation(recordExpense);
  const amount = parseCedi(amountText);

  function close() {
    setDescription("");
    setAmountText("");
    setPaidBy("");
    setApprovedBy("");
    setReceiptRef("");
    setDate("");
    record.reset();
    onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    record.mutate(
      [
        {
          description,
          category,
          amount,
          paidBy: paidBy || me?.fullName || "",
          approvedBy,
          receiptRef,
          date: date || today,
        },
      ],
      {
        onSuccess: (r) => {
          flash(
            `${r.ref} recorded: ${formatCedi(r.amount)} for ${r.category.toLowerCase()}.`,
            "success",
          );
          close();
        },
      },
    );
  }

  return (
    <Sheet open={open} onClose={close} title="New Expense">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <MoneyField
          hero
          label="Amount"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          error={amountText && !amount ? "Enter an amount like 5 or 12.50" : null}
        />
        <TextField
          label="What was it for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <SelectField
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </SelectField>
        <TextField
          label="Paid by"
          value={paidBy}
          placeholder={me?.fullName}
          onChange={(e) => setPaidBy(e.target.value)}
          hint="Leave blank if you paid it yourself."
        />
        <TextField
          label="Approved by"
          value={approvedBy}
          onChange={(e) => setApprovedBy(e.target.value)}
        />
        <TextField
          label="Receipt or invoice number"
          value={receiptRef}
          onChange={(e) => setReceiptRef(e.target.value)}
          optional
        />
        <TextField
          label="Date"
          type="date"
          value={date || today}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          hint="The cash comes out of what you're holding."
        />
        <InlineError error={record.error} />
        <Button
          type="submit"
          block
          loading={record.isPending}
          disabled={!amount || description.trim().length < 3 || approvedBy.trim().length < 2}
          className="mt-2"
        >
          Record Expense
        </Button>
      </form>
    </Sheet>
  );
}
