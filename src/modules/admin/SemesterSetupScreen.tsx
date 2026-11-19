import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarPlus, Lock, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Field, MoneyInput, selectClass } from "@/components/Field";
import { FormSheet } from "@/components/FormSheet";
import { PageHeader, SectionTitle } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import * as api from "@/data/api";
import { currentSemesterQuery, ratesQuery, semestersQuery, semesterWeeksQuery } from "@/data/queries";
import type { SemesterWeek } from "@/data/types";
import { addDays, formatDate, todayISO } from "@/lib/dates";
import { parseCedi } from "@/lib/money";
import { useApiMutation } from "@/lib/use-api-mutation";
import { cn } from "@/lib/utils";
import { AdminNav } from "./AdminNav";

export function SemesterSetupScreen() {
  const { data: current } = useSuspenseQuery(currentSemesterQuery());
  const { data: semesters } = useSuspenseQuery(semestersQuery());
  const [semesterId, setSemesterId] = useState(current.id);
  const semester = semesters.find((s) => s.id === semesterId) ?? current;
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState(false);

  return (
    <div>
      <AdminNav />
      <PageHeader
        eyebrow="Director"
        title="Semester"
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden /> New
          </Button>
        }
      />

      <Field id="sem-pick" label="Semester">
        <select id="sem-pick" value={semester.id} onChange={(e) => setSemesterId(e.target.value)} className={selectClass}>
          {[...semesters]
            .sort((a, b) => b.startsOn.localeCompare(a.startsOn))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isClosed ? " (closed)" : ""}
              </option>
            ))}
        </select>
      </Field>
      <p className="mt-2 text-muted-foreground">
        {formatDate(semester.startsOn)} to {formatDate(semester.endsOn)}
      </p>

      {semester.isClosed ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card p-4 font-medium">
          <Lock className="size-5 text-gold-deep" aria-hidden /> This semester is closed. Nothing in it can change.
        </p>
      ) : (
        <>
          <RatesCard key={semester.id} semesterId={semester.id} />
          <WeeksCard semesterId={semester.id} />
          <Button variant="destructive" size="lg" className="mt-8 w-full" onClick={() => setClosing(true)}>
            <Lock aria-hidden /> Close {semester.name}
          </Button>
        </>
      )}

      {creating && <NewSemesterSheet onClose={() => setCreating(false)} onCreated={setSemesterId} />}
      <CloseSheet open={closing} semesterId={semester.id} name={semester.name} onClose={() => setClosing(false)} />
    </div>
  );
}

function RatesCard({ semesterId }: { semesterId: string }) {
  const { data: rates } = useSuspenseQuery(ratesQuery(semesterId));
  const rateOf = (c: "executive" | "member") => rates.find((r) => r.category === c)?.weeklyAmount ?? 0;
  const [exec, setExec] = useState(String(rateOf("executive") / 100));
  const [member, setMember] = useState(String(rateOf("member") / 100));
  const e = parseCedi(exec);
  const m = parseCedi(member);
  const changed = e !== rateOf("executive") || m !== rateOf("member");
  const mutation = useApiMutation((v: { e: number; m: number }) =>
    api.setRates(semesterId, [
      { category: "executive", weeklyAmount: v.e },
      { category: "member", weeklyAmount: v.m },
    ]),
  { success: "Weekly rates saved" });

  return (
    <>
      <SectionTitle>Weekly dues</SectionTitle>
      <form
        onSubmit={(ev: FormEvent) => {
          ev.preventDefault();
          if (e !== null && m !== null) mutation.mutate({ e, m });
        }}
        className="space-y-3 rounded-xl border border-border bg-card p-4"
      >
        <Field id="rate-exec" label="Executives, per week">
          <MoneyInput id="rate-exec" value={exec} onChange={setExec} />
        </Field>
        <Field id="rate-member" label="Members, per week">
          <MoneyInput id="rate-member" value={member} onChange={setMember} />
        </Field>
        <p className="text-sm text-muted-foreground">Changing a rate changes what everyone in that group owes for the whole semester.</p>
        <Button type="submit" className="w-full" disabled={e === null || m === null || !changed || mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save rates"}
        </Button>
      </form>
    </>
  );
}

function WeeksCard({ semesterId }: { semesterId: string }) {
  const { data: weeks } = useSuspenseQuery(semesterWeeksQuery(semesterId));
  const [turningOff, setTurningOff] = useState<SemesterWeek | null>(null);
  const [adding, setAdding] = useState(false);
  const toggle = useApiMutation((v: { id: string; counts: boolean; label?: string }) => api.setWeekCounts(v.id, v.counts, v.label), {
    success: (w) => (w.counts ? `Week ${w.weekNo} now counts for dues` : `Week ${w.weekNo} is free (${w.label})`),
    onSuccess: () => setTurningOff(null),
  });
  const today = todayISO();
  const sorted = [...weeks].sort((a, b) => a.weekNo - b.weekNo);
  const counted = sorted.filter((w) => w.counts).length;

  return (
    <>
      <SectionTitle
        action={
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <CalendarPlus aria-hidden /> Add weeks
          </Button>
        }
      >
        Weeks
      </SectionTitle>
      <p className="-mt-1 mb-3 text-muted-foreground">
        {counted} of {sorted.length} weeks count for dues. Switch a week off for breaks, exams or weeks with no rehearsal.
      </p>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {sorted.map((w) => {
          const isNow = w.weekStart <= today && today < addDays(w.weekStart, 7);
          return (
            <li key={w.id} className={cn("flex min-h-16 items-center gap-3 px-4 py-2", isNow && "bg-accent")}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  Week {w.weekNo} · {formatDate(w.weekStart, false)}
                  {isNow && <span className="ml-2 text-sm text-gold-text">This week</span>}
                </p>
                <p className={cn("text-muted-foreground", !w.counts && "line-through")}>{w.counts ? "Counts for dues" : w.label ?? "No dues"}</p>
              </div>
              <Switch
                checked={w.counts}
                disabled={toggle.isPending}
                aria-label={`Week ${w.weekNo} counts for dues`}
                onCheckedChange={(on) => (on ? toggle.mutate({ id: w.id, counts: true }) : setTurningOff(w))}
              />
            </li>
          );
        })}
      </ul>

      {turningOff && (
        <LabelSheet
          week={turningOff}
          busy={toggle.isPending}
          onClose={() => setTurningOff(null)}
          onConfirm={(label) => toggle.mutate({ id: turningOff.id, counts: false, label })}
        />
      )}
      {adding && <AddWeeksSheet semesterId={semesterId} onClose={() => setAdding(false)} />}
    </>
  );
}

function LabelSheet({ week, busy, onClose, onConfirm }: { week: SemesterWeek; busy: boolean; onClose: () => void; onConfirm: (label: string) => void }) {
  const [label, setLabel] = useState("No rehearsal");
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title={`Make week ${week.weekNo} free?`} description="Nobody owes dues for this week.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(label);
        }}
        className="space-y-4"
      >
        <Field id="wk-label" label="Why" hint='Members see this, e.g. "Interim Assessment" or "Christmas break".'>
          <Input id="wk-label" value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={40} />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={busy || !label.trim()}>
          {busy ? "Saving…" : "Make this week free"}
        </Button>
      </form>
    </FormSheet>
  );
}

function AddWeeksSheet({ semesterId, onClose }: { semesterId: string; onClose: () => void }) {
  const [count, setCount] = useState(4);
  const mutation = useApiMutation((n: number) => api.addWeeks(semesterId, n), { success: "Weeks added", onSuccess: onClose });
  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Add weeks" description="New weeks go on the end of this semester and count for dues.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(count);
        }}
        className="space-y-4"
      >
        <Field id="add-count" label="How many weeks">
          <Input id="add-count" type="number" inputMode="numeric" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={count < 1 || count > 20 || mutation.isPending}>
          {mutation.isPending ? "Adding…" : `Add ${count} week${count === 1 ? "" : "s"}`}
        </Button>
      </form>
    </FormSheet>
  );
}

function NewSemesterSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState(todayISO());
  const [endsOn, setEndsOn] = useState(addDays(todayISO(), 7 * 12 - 1));
  const mutation = useApiMutation(api.saveSemester, {
    success: (s) => `${s.name} created. Check its weeks and rates.`,
    onSuccess: (s) => {
      onCreated(s.id);
      onClose();
    },
  });
  return (
    <FormSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="New semester"
      description="Weeks are made Monday by Monday. Rates copy from the last semester, and every current member is added."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({ name, startsOn, endsOn });
        }}
        className="space-y-4"
      >
        <Field id="ns-name" label="Name" hint='For example "2026/27 Sem 2".'>
          <Input id="ns-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field id="ns-start" label="Starts">
            <Input id="ns-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
          </Field>
          <Field id="ns-end" label="Ends">
            <Input id="ns-end" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} required />
          </Field>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={!name.trim() || endsOn <= startsOn || mutation.isPending}>
          {mutation.isPending ? "Creating…" : "Create semester"}
        </Button>
      </form>
    </FormSheet>
  );
}

function CloseSheet({ open, semesterId, name, onClose }: { open: boolean; semesterId: string; name: string; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const mutation = useApiMutation(api.closeSemester, { success: `${name} closed`, onSuccess: onClose });
  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setTyped("");
          onClose();
        }
      }}
      title={`Close ${name}?`}
      description="After closing, no payments, weeks or rates in it can change. This can't be undone."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(semesterId);
        }}
        className="space-y-4"
      >
        <Field id="close-confirm" label='Type "CLOSE" to confirm'>
          <Input id="close-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
        <Button type="submit" variant="destructive" size="lg" className="w-full" disabled={typed.trim().toUpperCase() !== "CLOSE" || mutation.isPending}>
          {mutation.isPending ? "Closing…" : `Close ${name}`}
        </Button>
      </form>
    </FormSheet>
  );
}
