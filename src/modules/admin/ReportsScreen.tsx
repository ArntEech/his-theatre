import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { FileDown, Printer } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Field } from "@/components/Field";
import { FormSheet } from "@/components/FormSheet";
import { Logo } from "@/components/Logo";
import { Money } from "@/components/Money";
import { PageHeader, SectionTitle } from "@/components/PageHeader";
import { PageLoader } from "@/components/StateViews";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currentSemesterQuery, membersQuery, officersQuery, reportQuery } from "@/data/queries";
import type { IncomeSource, ISODate, MemberWithDues, Report } from "@/data/types";
import { cedis, downloadCsv, type Cell } from "@/lib/csv";
import { addDays, formatDate, todayISO } from "@/lib/dates";
import { STATUS_LABEL } from "@/lib/dues";
import { INCOME_SOURCE_LABEL, METHOD_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { AdminNav } from "./AdminNav";

type Preset = "week" | "month" | "semester" | "custom";

function mondayOf(date: ISODate): ISODate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

type Pending = { kind: "statement" | "dues" | "payments" | "pdf" } | null;

export function ReportsScreen() {
  const { data: semester } = useSuspenseQuery(currentSemesterQuery());
  const { data: officers } = useSuspenseQuery(officersQuery());
  const { data: members } = useSuspenseQuery(membersQuery({}));
  const today = todayISO();
  const [preset, setPreset] = useState<Preset>("semester");
  const [custom, setCustom] = useState({ from: semester.startsOn, to: today });
  const [pending, setPending] = useState<Pending>(null);

  const range =
    preset === "week"
      ? { from: mondayOf(today), to: today }
      : preset === "month"
        ? { from: `${today.slice(0, 8)}01`, to: today }
        : preset === "semester"
          ? { from: semester.startsOn, to: today < semester.endsOn ? today : semester.endsOn }
          : custom;
  const validRange = range.from <= range.to;
  const { data: report, isPending } = useQuery({ ...reportQuery(range.from, range.to), enabled: validRange });

  const nameOf = (id: string) => officers.find((o) => o.id === id)?.fullName ?? "Officer";
  const memberName = (id: string) => members.find((m) => m.id === id)?.fullName ?? id;
  const rangeLabel = `${formatDate(range.from)} to ${formatDate(range.to)}`;

  function runExport(kind: NonNullable<Pending>["kind"]) {
    setPending(null);
    if (kind === "pdf") {
      // The browser's "Save as PDF" option in the print dialog creates the PDF.
      setTimeout(() => window.print(), 300);
      return;
    }
    if (!report) return;
    const stamp = `${range.from}_to_${range.to}`;
    if (kind === "statement") downloadCsv(`his-theatre-statement_${stamp}`, statementRows(report, rangeLabel));
    if (kind === "dues") downloadCsv(`his-theatre-dues_${semester.name.replace(/\W+/g, "-")}`, duesRows(members));
    if (kind === "payments")
      downloadCsv(
        `his-theatre-payments_${stamp}`,
        [
          ["Date", "Receipt", "Member", "Amount (GH₵)", "Method", "MoMo ID", "Recorded by", "Note"],
          ...report.payments.map((p): Cell[] => [
            p.paidOn,
            p.receiptNo,
            memberName(p.memberId),
            cedis(p.amount),
            METHOD_LABEL[p.method],
            p.momoReference ?? "",
            nameOf(p.recordedBy),
            p.note ?? "",
          ]),
        ],
      );
  }

  return (
    <div>
      <AdminNav />
      <div className="print:hidden">
        <PageHeader eyebrow="Admin" title="Reports" />
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex w-max gap-2" role="group" aria-label="Date range">
            {(
              [
                ["week", "This week"],
                ["month", "This month"],
                ["semester", "This semester"],
                ["custom", "Custom"],
              ] as [Preset, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={preset === value}
                onClick={() => setPreset(value)}
                className={cn(
                  "min-h-11 rounded-full border-2 px-4 font-semibold",
                  preset === value ? "border-gold-deep bg-gold text-primary-foreground" : "border-border bg-card",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {preset === "custom" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field id="r-from" label="From">
              <Input id="r-from" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            </Field>
            <Field id="r-to" label="To">
              <Input id="r-to" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
            </Field>
          </div>
        )}
        {!validRange && <p className="mt-2 font-medium text-status-behind">The start date must be before the end date.</p>}
      </div>

      {/* Printed header (PDF) */}
      <div className="hidden items-center gap-3 print:flex">
        <Logo className="h-14 w-10" />
        <div>
          <p className="font-display text-xl font-semibold">HIS Theatre Ministry · Finance report</p>
          <p>{rangeLabel}</p>
        </div>
      </div>

      {!validRange ? null : isPending || !report ? (
        <PageLoader />
      ) : (
        <>
          <SectionTitle>Statement</SectionTitle>
          <p className="-mt-2 mb-3 text-muted-foreground print:hidden">{rangeLabel}</p>
          <div className="rounded-xl border border-border bg-card">
            <Line label="Opening balance" value={report.openingBalance} strong />
            <Group title="Dues collected" total={report.duesCollected}>
              <Line label="Cash" value={report.duesCash} />
              <Line label="MoMo" value={report.duesMomo} />
              {Object.entries(report.duesByDrive)
                .sort((a, b) => b[1] - a[1])
                .map(([drive, v]) => (
                  <Line key={drive} label={`${drive} drive`} value={v} quiet />
                ))}
            </Group>
            <Group title="Other income" total={report.incomeTotal}>
              {(Object.entries(report.incomeBySource) as [IncomeSource, number][])
                .filter(([, v]) => v !== 0)
                .map(([s, v]) => (
                  <Line key={s} label={INCOME_SOURCE_LABEL[s]} value={v} />
                ))}
            </Group>
            <Group title="Spending" total={-report.expensesTotal}>
              {Object.entries(report.expensesByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([c, v]) => (
                  <Line key={c} label={c} value={-v} />
                ))}
            </Group>
            <Line label="Closing balance" value={report.closingBalance} strong />
          </div>

          <SectionTitle>Dues by member · {semester.name}</SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[520px] text-left">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Member</th>
                  <th className="px-3 py-2 text-right font-semibold">Due so far</th>
                  <th className="px-3 py-2 text-right font-semibold">Paid</th>
                  <th className="px-3 py-2 text-right font-semibold">Owing</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...members]
                  .sort((a, b) => a.fullName.localeCompare(b.fullName))
                  .map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2">
                        <p className="font-semibold">{m.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          <span className="num">{m.memberCode}</span> · {m.drive}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Money value={m.dues?.dueSoFar ?? 0} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Money value={m.dues?.paid ?? 0} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Money value={m.dues?.owing ?? 0} className={cn((m.dues?.owing ?? 0) > 0 && "font-semibold text-status-behind")} />
                      </td>
                      <td className="px-3 py-2">{m.status && <StatusBadge status={m.status} className="px-2 py-0.5" />}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 space-y-2 print:hidden">
            <p className="font-display text-lg font-semibold">Download</p>
            <Button size="lg" className="w-full" onClick={() => setPending({ kind: "pdf" })}>
              <Printer aria-hidden /> PDF of this report
            </Button>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button variant="outline" onClick={() => setPending({ kind: "statement" })}>
                <FileDown aria-hidden /> Statement (Excel)
              </Button>
              <Button variant="outline" onClick={() => setPending({ kind: "dues" })}>
                <FileDown aria-hidden /> Dues list (Excel)
              </Button>
              <Button variant="outline" onClick={() => setPending({ kind: "payments" })}>
                <FileDown aria-hidden /> Payments (Excel)
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Excel files download as .csv, which Excel and Google Sheets open directly.</p>
          </div>
        </>
      )}

      <FormSheet
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Before you download"
        description="This file contains members' personal details. Share it only with officers."
      >
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={() => setPending(null)}>
            Cancel
          </Button>
          <Button size="lg" onClick={() => pending && runExport(pending.kind)}>
            I understand
          </Button>
        </div>
      </FormSheet>
    </div>
  );
}

function Group({ title, total, children }: { title: string; total: number; children: ReactNode }) {
  return (
    <div className="border-t border-border">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3">
        <p className="font-semibold">{title}</p>
        <Money value={total} className="text-lg font-semibold" />
      </div>
      <div className="pb-2">{children}</div>
    </div>
  );
}

function Line({ label, value, strong, quiet }: { label: string; value: number; strong?: boolean; quiet?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 px-4", strong ? "py-3" : "py-1", quiet && "text-muted-foreground")}>
      <span className={cn(strong ? "font-display text-lg font-semibold" : "pl-3")}>{label}</span>
      <Money value={value} className={cn(strong && "text-2xl font-semibold")} />
    </div>
  );
}

function statementRows(r: Report, rangeLabel: string): Cell[][] {
  const rows: Cell[][] = [["HIS Theatre Ministry finance statement"], [rangeLabel], [], ["Item", "Amount (GH₵)"]];
  rows.push(["Opening balance", cedis(r.openingBalance)]);
  rows.push(["Dues collected", cedis(r.duesCollected)], ["  Cash", cedis(r.duesCash)], ["  MoMo", cedis(r.duesMomo)]);
  for (const [drive, v] of Object.entries(r.duesByDrive)) rows.push([`  ${drive} drive`, cedis(v)]);
  rows.push(["Other income", cedis(r.incomeTotal)]);
  for (const [s, v] of Object.entries(r.incomeBySource)) if (v) rows.push([`  ${INCOME_SOURCE_LABEL[s as IncomeSource]}`, cedis(v)]);
  rows.push(["Spending", cedis(-r.expensesTotal)]);
  for (const [c, v] of Object.entries(r.expensesByCategory)) rows.push([`  ${c}`, cedis(-v)]);
  rows.push(["Closing balance", cedis(r.closingBalance)]);
  return rows;
}

function duesRows(members: MemberWithDues[]): Cell[][] {
  return [
    ["Member ID", "Name", "Drive", "Category", "Weekly rate", "Due so far", "Paid", "Owing", "Credit", "Status"],
    ...[...members]
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((m): Cell[] => [
        m.memberCode,
        m.fullName,
        m.drive,
        m.category === "executive" ? "Executive" : "Member",
        cedis(m.dues?.weeklyRate ?? 0),
        cedis(m.dues?.dueSoFar ?? 0),
        cedis(m.dues?.paid ?? 0),
        cedis(m.dues?.owing ?? 0),
        cedis(m.dues?.credit ?? 0),
        m.status ? STATUS_LABEL[m.status] : "",
      ]),
  ];
}
