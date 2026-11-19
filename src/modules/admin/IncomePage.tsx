import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { HandCoins, Plus, Undo2 } from "lucide-react";
import { recordIncome, reverseIncome } from "@/data/api";
import { useApiMutation, useReport } from "@/data/queries";
import {
  INCOME_SOURCE_LABELS,
  type IncomeRow,
  type IncomeSource,
  type PaymentMethod,
} from "@/data/types";
import { PageHeader } from "@/components/PageHeader";
import { Button, IconButton } from "@/components/Button";
import { MoneyField, Segmented, SelectField, TextField } from "@/components/Field";
import { SummaryCard } from "@/components/Card";
import { ListRow, ListSection, ValueRow } from "@/components/List";
import { BigMoney } from "@/components/Money";
import { Sheet } from "@/components/Sheet";
import { ErrorNotice, InlineError, LoadingBlock } from "@/components/States";
import { useFlash } from "@/components/Flash";
import { formatCedi, parseCedi } from "@/lib/money";
import { formatDate, formatDateTime, formatDay } from "@/lib/dates";
import { methodLabel } from "@/modules/dues/labels";
import { EntryList } from "./components/EntryList";
import { VoidSheet } from "./components/VoidSheet";
import { useSemesterRange } from "./useSemesterRange";

const SOURCES = Object.keys(INCOME_SOURCE_LABELS) as IncomeSource[];

export function IncomePage() {
  const [params, setParams] = useSearchParams();
  const { semester, from, to } = useSemesterRange();
  const report = useReport(from, to);
  const [openId, setOpenId] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<IncomeRow | null>(null);
  const flash = useFlash();
  const reverse = useApiMutation(reverseIncome);
  const formOpen = params.get("new") === "1";
  const rows = report.data?.incomeRows ?? [];
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
        title="Other Income"
        action={
          <IconButton label="Record income" onClick={() => setFormOpen(true)}>
            <Plus aria-hidden className="size-6" strokeWidth={2.2} />
          </IconButton>
        }
      />
      {report.isError && <ErrorNotice error={report.error} onRetry={() => report.refetch()} />}
      {(semester.isPending || report.isPending) && <LoadingBlock lines={4} />}
      {report.data && (
        <>
          <SummaryCard
            label="Received This Semester"
            icon={<HandCoins aria-hidden className="size-4" strokeWidth={2.4} />}
            accent="text-paid-text"
            className="mb-4"
          >
            <BigMoney value={report.data.income.total} />
            <p className="mt-1 text-subhead text-label-2">
              Donations, offerings, ticket sales, fundraising and levies. Dues are counted
              separately.
            </p>
          </SummaryCard>
          <Button
            block
            className="mb-8"
            icon={<Plus aria-hidden className="size-5" strokeWidth={2.4} />}
            onClick={() => setFormOpen(true)}
          >
            Record Income
          </Button>
          {report.data.income.bySource.length > 0 && (
            <ListSection header="By Source">
              {report.data.income.bySource.map((s) => (
                <ValueRow
                  key={s.source}
                  label={INCOME_SOURCE_LABELS[s.source]}
                  value={formatCedi(s.amount)}
                />
              ))}
            </ListSection>
          )}
          <EntryList
            header="All Income"
            empty="No other income recorded this semester."
            onOpen={setOpenId}
            items={rows.map((i) => ({
              id: i.id,
              title: i.reversesRef ? `Void of ${i.reversesRef}` : i.description,
              meta: `${i.ref} · ${formatDay(i.date)} · ${INCOME_SOURCE_LABELS[i.source]} · ${methodLabel(i.method)}`,
              amount: i.amount,
              voided: Boolean(i.voidedBy),
              icon: i.reversesRef ? Undo2 : HandCoins,
              color: i.reversesRef ? "orange" : "green",
            }))}
          />
        </>
      )}

      <IncomeForm open={formOpen} onClose={() => setFormOpen(false)} today={to} />

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
              <ValueRow label="Source" value={INCOME_SOURCE_LABELS[open.source]} />
              <ValueRow label="Received by" value={methodLabel(open.method)} />
              <ValueRow label="Date" value={formatDate(open.date)} />
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
                  title="Void This Entry"
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

function IncomeForm({
  open,
  onClose,
  today,
}: {
  open: boolean;
  onClose: () => void;
  today: string;
}) {
  const flash = useFlash();
  const [source, setSource] = useState<IncomeSource>("donation");
  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState("");
  const record = useApiMutation(recordIncome);
  const amount = parseCedi(amountText);

  function close() {
    setDescription("");
    setAmountText("");
    setDate("");
    record.reset();
    onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    record.mutate([{ source, description, amount, method, date: date || today }], {
      onSuccess: (r) => {
        flash(
          `${r.ref} recorded: ${formatCedi(r.amount)} ${INCOME_SOURCE_LABELS[r.source].toLowerCase()}.`,
          "success",
        );
        close();
      },
    });
  }

  return (
    <Sheet open={open} onClose={close} title="New Income">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <MoneyField
          hero
          label="Amount"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          error={amountText && !amount ? "Enter an amount like 5 or 12.50" : null}
        />
        <SelectField
          label="Source"
          value={source}
          onChange={(e) => setSource(e.target.value as IncomeSource)}
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {INCOME_SOURCE_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Description"
          hint="Who gave it, or which event it came from."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Segmented<PaymentMethod>
          label="Received by"
          value={method}
          onChange={setMethod}
          options={[
            { value: "cash", label: "Cash" },
            { value: "momo", label: "Mobile Money" },
          ]}
        />
        <TextField
          label="Date"
          type="date"
          value={date || today}
          max={today}
          onChange={(e) => setDate(e.target.value)}
        />
        <InlineError error={record.error} />
        <Button
          type="submit"
          block
          loading={record.isPending}
          disabled={!amount || description.trim().length < 3}
          className="mt-2"
        >
          Record Income
        </Button>
      </form>
    </Sheet>
  );
}
