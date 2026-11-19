import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Lock, LogOut, MessageCircle, Pencil, Phone, Scale, CalendarClock, Wallet } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { ChoiceGroup, Field, MoneyInput, selectClass } from "@/components/Field";
import { FormSheet } from "@/components/FormSheet";
import { Money } from "@/components/Money";
import { SectionTitle } from "@/components/PageHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState } from "@/components/StateViews";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import * as api from "@/data/api";
import { currentSemesterQuery, drivesQuery, memberQuery, semesterWeeksQuery } from "@/data/queries";
import type { MemberCategory, Payment } from "@/data/types";
import { formatDate, formatDateTime, todayISO } from "@/lib/dates";
import { formatCedi, parseCedi } from "@/lib/money";
import { useApiMutation } from "@/lib/use-api-mutation";
import { whatsappLink } from "@/lib/whatsapp";
import { AdminNav } from "./AdminNav";
import { ReasonSheet } from "./ReasonSheet";
import { RecordPaymentSheet } from "./RecordPaymentSheet";
import { ReceiptList } from "../dues/ReceiptList";

type Sheet = "pay" | "adjust" | "start" | "code" | "edit" | "left" | null;

export function MemberDetailScreen({ memberId }: { memberId: string }) {
  const { data: semester } = useSuspenseQuery(currentSemesterQuery());
  const { data: m } = useSuspenseQuery(memberQuery(memberId));
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reversing, setReversing] = useState<Payment | null>(null);
  const close = () => setSheet(null);

  const unlock = useApiMutation(api.unlockMember, { success: (x) => `${x.fullName} can sign in again` });
  const reverse = useApiMutation((v: { id: string; reason: string }) => api.reversePayment(v.id, v.reason), {
    success: (p) => `Reversed. Correcting entry ${p.receiptNo} added.`,
    onSuccess: () => setReversing(null),
  });

  const d = m.dues;
  const left = !m.isActive;

  return (
    <div>
      <AdminNav />
      <Link to="/admin/members" className="mb-3 inline-flex min-h-11 items-center gap-1.5 font-semibold text-gold-text">
        <ArrowLeft className="size-5" aria-hidden /> All members
      </Link>

      <header className="animate-rise">
        <p className="eyebrow">
          <span className="num">{m.memberCode}</span> · {m.drive} · {m.category === "executive" ? "Executive" : "Member"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold">{m.fullName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {m.status && <StatusBadge status={m.status} />}
          {m.isLocked && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-status-behind/40 bg-status-behind/10 px-3 py-1 text-sm font-semibold text-status-behind">
              <Lock className="size-4" aria-hidden /> Locked
            </span>
          )}
          {!m.isActivated && <span className="rounded-full border border-border px-3 py-1 text-sm font-semibold">Not set up yet</span>}
          {left && <span className="rounded-full border border-border px-3 py-1 text-sm font-semibold">Left {m.leftOn ? formatDate(m.leftOn) : ""}</span>}
        </div>
        <a href={`tel:${m.phone}`} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-muted-foreground">
          <Phone className="size-4" aria-hidden /> <span className="num">{m.phone}</span>
        </a>
      </header>

      {d ? (
        <section className="mt-4 rounded-xl border border-border bg-card p-4" aria-label="Dues this semester">
          <p className="text-muted-foreground">{semester.name}</p>
          {d.owing > 0 ? (
            <p className="mt-1 text-lg">
              Owes <Money value={d.owing} className="text-4xl font-semibold text-status-behind" />
              <span className="ml-2 text-muted-foreground">
                {d.weeksBehind} week{d.weeksBehind === 1 ? "" : "s"} behind
              </span>
            </p>
          ) : d.credit > 0 ? (
            <p className="mt-1 text-lg">
              <Money value={d.credit} className="text-4xl font-semibold text-status-ahead" /> ahead
            </p>
          ) : (
            <p className="mt-1 text-2xl font-semibold text-status-paid">Up to date</p>
          )}
          <ProgressBar className="mt-3" value={d.progressPct} label="Paid towards the semester total" />
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            <Figure label="Semester total" value={d.semesterTotal} />
            <Figure label="Due so far" value={d.dueSoFar} />
            <Figure label="Paid" value={d.paid} />
            <Figure label="Weekly rate" value={d.weeklyRate} />
          </dl>
          {m.membership && <p className="mt-2 text-muted-foreground">Pays from week {m.membership.startWeekNo}.</p>}
        </section>
      ) : (
        <div className="mt-4">
          <EmptyState title="Not on this semester's dues list" />
        </div>
      )}

      {!left && d && (
        <Button size="lg" className="mt-4 w-full" onClick={() => setSheet("pay")} disabled={semester.isClosed}>
          <Wallet aria-hidden /> Record payment
        </Button>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {!left && d && <Action icon={<Scale />} label="Adjust what they owe" onClick={() => setSheet("adjust")} />}
        {!left && d && <Action icon={<CalendarClock />} label="Change start week" onClick={() => setSheet("start")} />}
        {!left && <Action icon={<KeyRound />} label={m.isActivated ? "New setup code" : "Issue setup code"} onClick={() => setSheet("code")} />}
        {m.isLocked && <Action icon={<Lock />} label={unlock.isPending ? "Unlocking…" : "Unlock"} onClick={() => unlock.mutate(m.id)} />}
        <Action icon={<Pencil />} label="Edit details" onClick={() => setSheet("edit")} />
        {!left && <Action icon={<LogOut />} label="Mark as left" onClick={() => setSheet("left")} />}
      </div>

      <SectionTitle>Payments this semester</SectionTitle>
      {m.payments.length ? (
        <ReceiptList
          payments={m.payments}
          action={(p, done) =>
            done || semester.isClosed ? null : (
              <button type="button" className="min-h-11 font-semibold text-status-behind underline underline-offset-4" onClick={() => setReversing(p)}>
                Reverse this payment
              </button>
            )
          }
        />
      ) : (
        <EmptyState title="No payments yet this semester" />
      )}

      {m.adjustments.length > 0 && (
        <>
          <SectionTitle>Adjustments</SectionTitle>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {m.adjustments.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold">{a.amount < 0 ? "Waived" : "Added"}</p>
                  <p className="text-muted-foreground">{a.reason}</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(a.createdAt)}</p>
                </div>
                <Money value={a.amount} className="text-lg font-semibold" />
              </li>
            ))}
          </ul>
        </>
      )}

      {sheet === "pay" && d && (
        <RecordPaymentSheet
          open
          onOpenChange={(o) => !o && close()}
          memberId={m.id}
          memberName={m.fullName}
          semesterId={semester.id}
          suggested={d.owing || undefined}
          weeklyRate={d.weeklyRate}
          phone={m.phone}
        />
      )}
      {sheet === "adjust" && <AdjustSheet memberId={m.id} name={m.fullName} semesterId={semester.id} onClose={close} />}
      {sheet === "start" && (
        <StartWeekSheet memberId={m.id} name={m.fullName} semesterId={semester.id} current={m.membership?.startWeekNo ?? 1} onClose={close} />
      )}
      {sheet === "code" && <SetupCodeSheet memberId={m.id} name={m.fullName} phone={m.phone} onClose={close} />}
      {sheet === "edit" && (
        <EditSheet
          memberId={m.id}
          initial={{ fullName: m.fullName, phone: m.phone, drive: m.drive, category: m.category }}
          onClose={close}
        />
      )}
      {sheet === "left" && <LeftSheet memberId={m.id} name={m.fullName} onClose={close} />}

      <ReasonSheet
        open={reversing !== null}
        onOpenChange={(o) => !o && setReversing(null)}
        title={reversing ? `Reverse ${reversing.receiptNo}?` : "Reverse payment"}
        description="This adds a correcting entry. The original stays on record."
        confirmLabel={reversing ? `Reverse ${formatCedi(reversing.amount)}` : "Reverse"}
        busy={reverse.isPending}
        onConfirm={(reason) => reversing && reverse.mutate({ id: reversing.id, reason })}
      />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <Money value={value} className="text-xl font-semibold" />
      </dd>
    </div>
  );
}

function Action({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 items-center gap-2 rounded-lg border-2 border-border bg-card px-3 text-left font-semibold hover:border-gold-deep [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-gold-deep"
    >
      {icon}
      {label}
    </button>
  );
}

function AdjustSheet({ memberId, name, semesterId, onClose }: { memberId: string; name: string; semesterId: string; onClose: () => void }) {
  const [kind, setKind] = useState<"waive" | "add">("waive");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const pesewas = parseCedi(amount);
  const mutation = useApiMutation(api.addAdjustment, { success: "Adjustment saved", onSuccess: onClose });
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!pesewas) return;
    mutation.mutate({ memberId, semesterId, amount: kind === "waive" ? -pesewas : pesewas, reason });
  }
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Adjust what they owe" description={name}>
      <form onSubmit={submit} className="space-y-4">
        <ChoiceGroup<"waive" | "add">
          name="Type of adjustment"
          value={kind}
          onChange={setKind}
          options={[
            { value: "waive", label: "Waive (owe less)" },
            { value: "add", label: "Add (owe more)" },
          ]}
        />
        <Field id="adj-amount" label="Amount">
          <MoneyInput id="adj-amount" value={amount} onChange={setAmount} />
        </Field>
        <Field id="adj-reason" label="Reason" hint="Saved with the record and shown in the audit log.">
          <Textarea id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-24 border-2 bg-paper text-base" required minLength={3} />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={!pesewas || reason.trim().length < 3 || mutation.isPending}>
          {mutation.isPending ? "Saving…" : pesewas ? `${kind === "waive" ? "Waive" : "Add"} ${formatCedi(pesewas)}` : "Save adjustment"}
        </Button>
      </form>
    </FormSheet>
  );
}

function StartWeekSheet({
  memberId,
  name,
  semesterId,
  current,
  onClose,
}: {
  memberId: string;
  name: string;
  semesterId: string;
  current: number;
  onClose: () => void;
}) {
  const { data: weeks } = useSuspenseQuery(semesterWeeksQuery(semesterId));
  const [weekNo, setWeekNo] = useState(current);
  const mutation = useApiMutation((n: number) => api.setStartWeek(memberId, semesterId, n), { success: "Start week changed", onSuccess: onClose });
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Change start week" description={`${name} only owes from this week on.`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(weekNo);
        }}
        className="space-y-4"
      >
        <Field id="start-week" label="Starts paying from">
          <select id="start-week" value={weekNo} onChange={(e) => setWeekNo(Number(e.target.value))} className={selectClass}>
            {[...weeks]
              .sort((a, b) => a.weekNo - b.weekNo)
              .map((w) => (
                <option key={w.id} value={w.weekNo}>
                  Week {w.weekNo} · {formatDate(w.weekStart, false)}
                  {w.counts ? "" : ` (${w.label ?? "no dues"})`}
                </option>
              ))}
          </select>
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={weekNo === current || mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save start week"}
        </Button>
      </form>
    </FormSheet>
  );
}

function SetupCodeSheet({ memberId, name, phone, onClose }: { memberId: string; name: string; phone: string; onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const mutation = useApiMutation(api.issueSetupCode, { onSuccess: setCode });
  const message = code
    ? `Hi ${name.split(" ")[0]}, your His Theatre setup code is ${code}. Open the app, tap "First time here?", enter your Member ID and this code, then choose your PIN. Keep it private.`
    : "";
  return (
    <FormSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Setup code"
      description={code ? "Shown once. Send it privately, then close this." : `${name} uses it once to choose a PIN. Any old code stops working.`}
    >
      {code ? (
        <div className="space-y-4">
          <p className="num rounded-xl border-2 border-gold-deep bg-accent py-5 text-center text-4xl font-semibold tracking-[0.3em]">{code}</p>
          <Button asChild size="lg" className="w-full">
            <a href={whatsappLink(phone, message)} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden /> Send on WhatsApp
            </a>
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <Button size="lg" className="w-full" onClick={() => mutation.mutate(memberId)} disabled={mutation.isPending}>
          {mutation.isPending ? "Creating…" : "Create setup code"}
        </Button>
      )}
    </FormSheet>
  );
}

function EditSheet({
  memberId,
  initial,
  onClose,
}: {
  memberId: string;
  initial: { fullName: string; phone: string; drive: string; category: MemberCategory };
  onClose: () => void;
}) {
  const { data: drives } = useSuspenseQuery(drivesQuery());
  const [v, setV] = useState(initial);
  const mutation = useApiMutation((input: typeof initial) => api.updateMember(memberId, input), { success: "Details saved", onSuccess: onClose });
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Edit details">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(v);
        }}
        className="space-y-4"
      >
        <Field id="edit-name" label="Full name">
          <Input id="edit-name" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} required maxLength={100} />
        </Field>
        <Field id="edit-phone" label="Phone">
          <Input id="edit-phone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} required />
        </Field>
        <Field id="edit-drive" label="Drive">
          <select id="edit-drive" value={v.drive} onChange={(e) => setV({ ...v, drive: e.target.value })} className={selectClass}>
            {drives.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field id="edit-cat" label="Dues group" hint="Changing this changes their weekly rate for the whole semester.">
          <ChoiceGroup<MemberCategory>
            name="Dues group"
            value={v.category}
            onChange={(category) => setV({ ...v, category })}
            options={[
              { value: "member", label: "Member" },
              { value: "executive", label: "Executive" },
            ]}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save details"}
        </Button>
      </form>
    </FormSheet>
  );
}

function LeftSheet({ memberId, name, onClose }: { memberId: string; name: string; onClose: () => void }) {
  const [leftOn, setLeftOn] = useState(todayISO());
  const mutation = useApiMutation((date: string) => api.deactivateMember(memberId, date), {
    success: `${name} marked as left`,
    onSuccess: onClose,
  });
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Mark as left" description={`${name} stops owing dues after this date. Their records stay.`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(leftOn);
        }}
        className="space-y-4"
      >
        <Field id="left-on" label="Left on">
          <Input id="left-on" type="date" value={leftOn} onChange={(e) => setLeftOn(e.target.value)} required />
        </Field>
        <Button type="submit" variant="destructive" size="lg" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Mark as left"}
        </Button>
      </form>
    </FormSheet>
  );
}
