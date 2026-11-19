import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRightLeft } from "lucide-react";

import { Money } from "@/components/Money";
import { SectionTitle } from "@/components/PageHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState } from "@/components/StateViews";
import { Button } from "@/components/ui/button";
import * as api from "@/data/api";
import {
  cashPositionQuery,
  currentMemberQuery,
  currentSemesterQuery,
  dashboardQuery,
  officersQuery,
  todayQuery,
} from "@/data/queries";
import { formatDate, formatDateTime } from "@/lib/dates";
import { INCOME_SOURCE_LABEL, METHOD_LABEL } from "@/lib/labels";
import { formatCedi } from "@/lib/money";
import { useApiMutation } from "@/lib/use-api-mutation";
import { AdminNav } from "./AdminNav";

export function TodayScreen() {
  const { data: me } = useSuspenseQuery(currentMemberQuery());
  const { data: today } = useSuspenseQuery(todayQuery());
  const { data: cash } = useSuspenseQuery(cashPositionQuery());
  const { data: semester } = useSuspenseQuery(currentSemesterQuery());
  const { data: dash } = useSuspenseQuery(dashboardQuery(semester.id));
  const { data: officers } = useSuspenseQuery(officersQuery());
  const nameOf = (id: string) => officers.find((o) => o.id === id)?.fullName ?? "Unknown";

  const confirm = useApiMutation(api.confirmHandover, { success: (h) => `Confirmed ${formatCedi(h.amount)} received (${h.ref})` });

  const entries = [
    ...today.payments.map((p) => ({ key: p.id, ref: p.receiptNo, title: `Dues · ${METHOD_LABEL[p.method]}`, amount: p.amount, at: p.createdAt })),
    ...today.income.map((i) => ({ key: i.id, ref: i.ref, title: `${INCOME_SOURCE_LABEL[i.source]} · ${METHOD_LABEL[i.method]}`, amount: i.amount, at: i.createdAt })),
    ...today.expenses.map((e) => ({ key: e.id, ref: e.ref, title: e.description, amount: -e.amount, at: e.createdAt })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div>
      <AdminNav />

      <section className="ticket spotlight overflow-hidden animate-rise" aria-label="Collected today">
        <div className="px-5 pb-5 pt-5">
          <p className="eyebrow">Today · {formatDate(today.date)}</p>
          <p className="mt-4 text-lg font-medium">Collected today</p>
          <Money value={today.collected} className="block text-6xl font-semibold leading-none" />
          <div className="mt-4 flex gap-6">
            <div>
              <p className="text-muted-foreground">Cash</p>
              <Money value={today.collectedCash} className="text-xl font-semibold" />
            </div>
            <div>
              <p className="text-muted-foreground">MoMo</p>
              <Money value={today.collectedMomo} className="text-xl font-semibold" />
            </div>
            <div>
              <p className="text-muted-foreground">Spent</p>
              <Money value={today.spent} className="text-xl font-semibold" />
            </div>
          </div>
        </div>
        <div className="ticket-tear" />
        <div className="p-4">
          <Button asChild className="w-full">
            <Link to="/admin/members">Record dues</Link>
          </Button>
        </div>
      </section>

      {cash.pendingHandovers.length > 0 && (
        <>
          <SectionTitle>Waiting for confirmation</SectionTitle>
          <ul className="space-y-3">
            {cash.pendingHandovers.map((h) => (
              <li key={h.id} className="rounded-xl border-2 border-gold-deep bg-accent p-4">
                <div className="flex items-start gap-3">
                  <ArrowRightLeft className="mt-1 size-5 text-gold-deep" aria-hidden />
                  <div className="flex-1">
                    <p className="font-semibold">
                      {nameOf(h.fromMemberId)} → {nameOf(h.toMemberId)}
                    </p>
                    <p className="text-muted-foreground">
                      {h.ref} · handed over {formatDateTime(h.recordedAt)}
                    </p>
                  </div>
                  <Money value={h.amount} className="text-2xl font-semibold" />
                </div>
                {h.toMemberId === me?.id ? (
                  <Button className="mt-3 w-full" disabled={confirm.isPending} onClick={() => confirm.mutate(h.id)}>
                    I received {formatCedi(h.amount)}
                  </Button>
                ) : (
                  <p className="mt-2 font-medium">Waiting for {nameOf(h.toMemberId)} to confirm.</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle>Who holds the money</SectionTitle>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-end justify-between gap-3 border-b border-border px-4 py-4">
          <div>
            <p className="text-muted-foreground">Ministry balance</p>
            <Money value={cash.balance} className="text-4xl font-semibold" />
          </div>
          <div className="text-right text-muted-foreground">
            <p>Cash <Money value={cash.cash} className="font-semibold text-foreground" /></p>
            <p>MoMo <Money value={cash.momo} className="font-semibold text-foreground" /></p>
          </div>
        </div>
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
          {cash.inTransit > 0 && (
            <li className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="font-semibold">Handed over, not yet confirmed</p>
              <Money value={cash.inTransit} className="text-xl font-semibold" />
            </li>
          )}
        </ul>
      </div>

      <SectionTitle>{semester.name}</SectionTitle>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">
            <Money value={dash.collected} /> collected of <Money value={dash.dueSoFar} /> due so far
          </span>
        </div>
        <ProgressBar className="mt-2" value={dash.dueSoFar ? (dash.collected / dash.dueSoFar) * 100 : 100} label="Dues collected against due so far" />
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Link to="/admin/members" search={{ status: "paid_up" }} className="rounded-lg border border-status-paid/40 bg-status-paid/10 p-2">
            <dd className="num text-3xl font-semibold text-status-paid">{dash.paidUp}</dd>
            <dt className="font-semibold text-status-paid">Paid up</dt>
          </Link>
          <Link to="/admin/members" search={{ status: "behind" }} className="rounded-lg border border-status-behind/40 bg-status-behind/10 p-2">
            <dd className="num text-3xl font-semibold text-status-behind">{dash.behind}</dd>
            <dt className="font-semibold text-status-behind">Behind</dt>
          </Link>
          <Link to="/admin/members" search={{ status: "ahead" }} className="rounded-lg border border-status-ahead/40 bg-status-ahead/10 p-2">
            <dd className="num text-3xl font-semibold text-status-ahead">{dash.ahead}</dd>
            <dt className="font-semibold text-status-ahead">Paid ahead</dt>
          </Link>
        </dl>
        <p className="mt-3 text-muted-foreground">
          Still owed: <Money value={dash.owing} className="font-semibold text-foreground" />
        </p>
      </div>

      <SectionTitle>Today's entries</SectionTitle>
      {entries.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {entries.map((e) => (
            <li key={e.key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{e.title}</p>
                <p className="num text-muted-foreground">{e.ref}</p>
              </div>
              <Money value={e.amount} className="text-lg font-semibold" />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing recorded yet today" />
      )}
    </div>
  );
}
