import { useMemo, useState } from "react";
import { Download, FileText, HandCoins, Printer, ReceiptText, Undo2, Wallet } from "lucide-react";
import { useCurrentSemester, useReport } from "@/data/queries";
import { INCOME_SOURCE_LABELS, type Report } from "@/data/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Segmented, TextField } from "@/components/Field";
import { SummaryCard } from "@/components/Card";
import { ListSection, ValueRow } from "@/components/List";
import { BigMoney } from "@/components/Money";
import { ErrorNotice, InlineError, LoadingBlock } from "@/components/States";
import { formatCedi, pesewasToInput } from "@/lib/money";
import { formatDate, formatDay, mondayOf, startOfMonth } from "@/lib/dates";
import { methodLabel } from "@/modules/dues/labels";
import { EntryList, type EntryItem } from "./components/EntryList";

type Preset = "today" | "week" | "month" | "semester" | "custom";

export function ReportsPage() {
  const semester = useCurrentSemester();
  const today = semester.data?.today ?? "";
  const [preset, setPreset] = useState<Preset>("semester");
  const [custom, setCustom] = useState({ from: "", to: "" });

  const range = useMemo(() => {
    if (!today) return { from: "", to: "" };
    const start = semester.data?.startsOn ?? today;
    switch (preset) {
      case "today":
        return { from: today, to: today };
      case "week":
        return { from: mondayOf(today), to: today };
      case "month":
        return { from: startOfMonth(today), to: today };
      case "semester":
        return { from: start, to: today < start ? start : today };
      default:
        return { from: custom.from || today, to: custom.to || today };
    }
  }, [preset, today, custom, semester.data?.startsOn]);

  const report = useReport(range.from, range.to);
  const r = report.data;
  const badRange = range.from > range.to;
  const entries = r ? transactions(r) : [];

  return (
    <>
      <PageHeader back={{ to: "/admin", label: "Admin" }} title="Reports" />

      <div className="no-print mb-6 flex flex-col gap-4">
        <Segmented<Preset>
          label="Period"
          hideLabel
          value={preset}
          onChange={(p) => {
            if (p === "custom") setCustom(range);
            setPreset(p);
          }}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
            { value: "semester", label: "Semester" },
            { value: "custom", label: "Custom" },
          ]}
        />
        {preset === "custom" && (
          <div className="anim-fade grid grid-cols-1 gap-4 min-[26rem]:grid-cols-2">
            <TextField
              label="From"
              type="date"
              value={custom.from}
              max={today}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
            <TextField
              label="To"
              type="date"
              value={custom.to}
              max={today}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </div>
        )}
        {badRange && (
          <InlineError error={new Error("The start date must be on or before the end date.")} />
        )}
      </div>

      {report.isError && <ErrorNotice error={report.error} onRetry={() => report.refetch()} />}
      {(semester.isPending || (report.isPending && !badRange)) && <LoadingBlock lines={6} />}

      {r && !badRange && (
        <div
          aria-busy={report.isFetching}
          className={report.isFetching ? "opacity-70 transition-opacity" : "transition-opacity"}
        >
          <SummaryCard
            label="Net"
            icon={<FileText aria-hidden className="size-4" strokeWidth={2.4} />}
            meta={`${formatDate(r.from)}${r.from !== r.to ? ` – ${formatDate(r.to)}` : ""}`}
            className="mb-8"
          >
            <BigMoney value={r.net} />
            <p className="tnum mt-1 text-subhead text-label-2">
              {formatCedi(r.totalIn)} in · {formatCedi(r.totalOut)} out · {r.dues.receipts} dues{" "}
              {r.dues.receipts === 1 ? "receipt" : "receipts"}
            </p>
          </SummaryCard>

          <ListSection header="Money In">
            <ValueRow label="Dues in cash" value={formatCedi(r.dues.cash)} />
            <ValueRow label="Dues by MoMo" value={formatCedi(r.dues.momo)} />
            {r.dues.reversals !== 0 && (
              <ValueRow label="Voided dues" value={formatCedi(r.dues.reversals)} />
            )}
            {r.income.bySource.map((s) => (
              <ValueRow
                key={s.source}
                label={INCOME_SOURCE_LABELS[s.source]}
                value={formatCedi(s.amount)}
              />
            ))}
            <ValueRow strong label="Total in" value={formatCedi(r.totalIn)} />
          </ListSection>

          <ListSection header="Money Out">
            {r.expenses.byCategory.map((c) => (
              <ValueRow key={c.category} label={c.category} value={formatCedi(c.amount)} />
            ))}
            <ValueRow strong label="Total out" value={formatCedi(r.totalOut)} />
          </ListSection>

          {r.handovers.length > 0 && (
            <ListSection header="Cash Handovers">
              {r.handovers.map((h) => (
                <ValueRow
                  key={h.id}
                  label={`${h.ref} · ${h.fromName} to ${h.toName}${h.confirmedAt ? "" : " (waiting)"}`}
                  value={formatCedi(h.amount)}
                />
              ))}
            </ListSection>
          )}

          <div className="no-print mb-8 grid grid-cols-2 gap-3">
            <Button
              variant="gray"
              size="medium"
              icon={<Download aria-hidden className="size-4" />}
              onClick={() => downloadCsv(r)}
            >
              Export CSV
            </Button>
            <Button
              variant="gray"
              size="medium"
              icon={<Printer aria-hidden className="size-4" />}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </div>

          <EntryList
            header="All Entries"
            aside={<span className="text-subhead text-label-2">{entries.length}</span>}
            empty="Nothing recorded in this period."
            items={entries}
          />
        </div>
      )}
    </>
  );
}

function transactions(r: Report): (EntryItem & { date: string; createdAt: string })[] {
  return [
    ...r.payments.map((p) => ({
      id: p.id,
      date: p.paidOn,
      createdAt: p.createdAt,
      title: p.reversesReceiptNo
        ? `Void of ${p.reversesReceiptNo} · ${p.memberName}`
        : p.memberName,
      meta: `${p.receiptNo} · ${formatDay(p.paidOn)} · Dues · ${methodLabel(p.method)}`,
      amount: p.amount,
      voided: Boolean(p.voidedBy),
      icon: p.reversesReceiptNo ? Undo2 : ReceiptText,
      color: p.reversesReceiptNo ? ("orange" as const) : ("green" as const),
    })),
    ...r.incomeRows.map((i) => ({
      id: i.id,
      date: i.date,
      createdAt: i.createdAt,
      title: i.reversesRef ? `Void of ${i.reversesRef}` : i.description,
      meta: `${i.ref} · ${formatDay(i.date)} · ${INCOME_SOURCE_LABELS[i.source]}`,
      amount: i.amount,
      voided: Boolean(i.voidedBy),
      icon: HandCoins,
      color: "green" as const,
    })),
    ...r.expenseRows.map((e) => ({
      id: e.id,
      date: e.date,
      createdAt: e.createdAt,
      title: e.reversesRef ? `Void of ${e.reversesRef}` : e.description,
      meta: `${e.ref} · ${formatDay(e.date)} · ${e.category}`,
      amount: -e.amount,
      voided: Boolean(e.voidedBy),
      icon: Wallet,
      color: "orange" as const,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function cedisText(pesewas: number) {
  return `${pesewas < 0 ? "-" : ""}${pesewasToInput(pesewas)}`;
}

function downloadCsv(r: Report) {
  const header = [
    "Date",
    "Reference",
    "Type",
    "Description",
    "Member",
    "Method",
    "Amount (GHS)",
    "Voided by",
    "Recorded by",
  ];
  const rows: string[][] = [
    ...r.payments.map((p) => [
      p.paidOn,
      p.receiptNo,
      p.reversesReceiptNo ? `Dues reversal of ${p.reversesReceiptNo}` : "Dues",
      p.note ?? "",
      `${p.memberName} (${p.memberCode})`,
      methodLabel(p.method) + (p.momoReference ? ` ${p.momoReference}` : ""),
      cedisText(p.amount),
      p.voidedBy ?? "",
      p.recordedByName,
    ]),
    ...r.incomeRows.map((i) => [
      i.date,
      i.ref,
      i.reversesRef ? `Income reversal of ${i.reversesRef}` : INCOME_SOURCE_LABELS[i.source],
      i.description,
      "",
      methodLabel(i.method),
      cedisText(i.amount),
      i.voidedBy ?? "",
      i.recordedByName,
    ]),
    ...r.expenseRows.map((e) => [
      e.date,
      e.ref,
      e.reversesRef ? `Expense reversal of ${e.reversesRef}` : `Expense: ${e.category}`,
      e.description,
      "",
      "",
      cedisText(-e.amount),
      e.voidedBy ?? "",
      e.recordedByName,
    ]),
  ].sort((a, b) => a[0].localeCompare(b[0]));
  // Text starting with = + - @ could run as a formula in Excel or Sheets; a leading
  // apostrophe keeps it as plain text. Plain numbers, like -12.50, are left alone.
  const escape = (raw: string) => {
    const v = /^[=+\-@\t\r]/.test(raw) && !/^-?\d+(\.\d+)?$/.test(raw) ? `'${raw}` : raw;
    return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `his-theatre-${r.from}-to-${r.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
