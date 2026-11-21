import { useState, type FormEvent } from "react";
import { CalendarCheck, CalendarOff, CalendarPlus, Lock } from "lucide-react";
import { closeSemester, saveSemester, setRates, setWeekCounts } from "@/data/api";
import { useApiMutation, useCurrentMember, useCurrentSemester, useSemesters } from "@/data/queries";
import type { SemesterDetail, SemesterWeek } from "@/data/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { MoneyField, Segmented, TextField } from "@/components/Field";
import { IconTile, ListRow, ListSection } from "@/components/List";
import { Sheet } from "@/components/Sheet";
import { ContentUnavailable, ErrorNotice, InlineError, LoadingBlock } from "@/components/States";
import { useFlash } from "@/components/Flash";
import { formatCedi, parseCedi, pesewasToInput } from "@/lib/money";
import { formatDate, formatDay } from "@/lib/dates";
import { isDirector } from "@/lib/roles";
import { cx } from "@/lib/cx";

export function SemesterPage() {
  const semester = useCurrentSemester();
  const semesters = useSemesters();
  const { data: me } = useCurrentMember();
  const [newOpen, setNewOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [weekId, setWeekId] = useState<string | null>(null);
  const s = semester.data;
  const week = s?.weeks.find((w) => w.id === weekId) ?? null;
  // Any officer can name a week and switch its dues; rates and dates are the Director's.
  const director = isDirector(me);

  return (
    <>
      <PageHeader back={{ to: "/admin", label: "Admin" }} overline={s?.name} title="Semester" />
      {semester.isError && (
        <ErrorNotice error={semester.error} onRetry={() => semester.refetch()} />
      )}
      {semester.isPending && <LoadingBlock lines={6} />}
      {s === null && <ContentUnavailable title="No Semester Yet" description="Start one below." />}
      {s && (
        <>
          {s.isClosed && (
            <div className="mb-6">
              <InlineError
                error={new Error(`${s.name} is closed. Its records can be read but not changed.`)}
              />
            </div>
          )}
          <ListSection
            header="Weeks"
            footer="Each week is due from its Monday. Tap a week to give it a name, like Interim Assessment, and choose whether members pay dues for it."
          >
            {s.weeks.map((w) => (
              <ListRow
                key={w.id}
                onClick={s.isClosed ? undefined : () => setWeekId(w.id)}
                leading={
                  <IconTile
                    icon={w.counts ? CalendarCheck : CalendarOff}
                    color={w.counts ? "green" : "gray"}
                  />
                }
                title={
                  <span className="flex flex-wrap items-center gap-x-2">
                    Week {w.weekNo}
                    {s.currentWeekNo === w.weekNo && (
                      <span className="rounded-full bg-tint px-2 py-px text-caption font-semibold text-on-tint">
                        This Week
                      </span>
                    )}
                  </span>
                }
                subtitle={`${formatDay(w.weekStart)}${w.label ? ` · ${w.label}` : ""}`}
                trailing={
                  <span className={cx(!w.counts && "text-label-3")}>
                    {w.counts ? "Dues" : "No dues"}
                  </span>
                }
              />
            ))}
          </ListSection>
          {director ? (
            <>
              <RatesForm
                key={`rates-${s.rates.map((r) => r.weeklyAmount).join("-")}`}
                semester={s}
              />
              <DetailsForm key={`${s.id}-${s.startsOn}-${s.endsOn}-${s.name}`} semester={s} />
            </>
          ) : (
            <ListSection
              header="Weekly Rates"
              footer="Only the Director can change rates and semester dates."
            >
              {s.rates.map((r) => (
                <ListRow
                  key={r.category}
                  title={r.category === "executive" ? "Executives" : "Members"}
                  trailing={formatCedi(r.weeklyAmount)}
                />
              ))}
            </ListSection>
          )}
        </>
      )}

      <ListSection header="All Semesters">
        {(semesters.data ?? []).map((x) => (
          <ListRow
            key={x.id}
            title={x.name}
            subtitle={`${formatDate(x.startsOn)} to ${formatDate(x.endsOn)}`}
            trailing={x.isClosed ? "Closed" : x.id === s?.id ? "Current" : "Open"}
          />
        ))}
        {director && (
          <ListRow
            leading={<IconTile icon={CalendarPlus} color="blue" />}
            title="Start a New Semester"
            action="tint"
            onClick={() => setNewOpen(true)}
          />
        )}
      </ListSection>

      {s && !s.isClosed && director && (
        <ListSection footer="Only the Director can close a semester.">
          <ListRow
            action="destructive"
            center
            title={
              <span className="inline-flex items-center gap-2">
                <Lock aria-hidden className="size-[1.1rem]" /> Close {s.name}
              </span>
            }
            onClick={() => setCloseOpen(true)}
          />
        </ListSection>
      )}

      {s && <WeekSheet week={week} semester={s} onClose={() => setWeekId(null)} />}
      <NewSemesterSheet open={newOpen} onClose={() => setNewOpen(false)} />
      {s && <CloseSheet open={closeOpen} onClose={() => setCloseOpen(false)} semester={s} />}
    </>
  );
}

function DetailsForm({ semester }: { semester: SemesterDetail }) {
  const flash = useFlash();
  const [name, setName] = useState(semester.name);
  const [startsOn, setStartsOn] = useState(semester.startsOn);
  const [endsOn, setEndsOn] = useState(semester.endsOn);
  const save = useApiMutation(saveSemester);
  const dirty =
    name !== semester.name || startsOn !== semester.startsOn || endsOn !== semester.endsOn;
  const datesChanged = startsOn !== semester.startsOn || endsOn !== semester.endsOn;

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate([{ id: semester.id, name, startsOn, endsOn }], {
      onSuccess: () => flash("Semester saved.", "success"),
    });
  }

  return (
    <ListSection
      header="Details"
      padded
      footer={
        datesChanged
          ? "Changing dates rebuilds the list of weeks. Weeks you keep stay as they are."
          : undefined
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={semester.isClosed}
        />
        <div className="grid grid-cols-1 gap-4 min-[26rem]:grid-cols-2">
          <TextField
            label="Starts"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            disabled={semester.isClosed}
          />
          <TextField
            label="Ends"
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            disabled={semester.isClosed}
          />
        </div>
        <InlineError error={save.error} />
        {!semester.isClosed && dirty && (
          <Button type="submit" variant="tinted" size="medium" loading={save.isPending}>
            Save Details
          </Button>
        )}
      </form>
    </ListSection>
  );
}

function RatesForm({ semester }: { semester: SemesterDetail }) {
  const flash = useFlash();
  const rateOf = (c: "executive" | "member") =>
    semester.rates.find((r) => r.category === c)?.weeklyAmount ?? 0;
  const [exec, setExec] = useState(pesewasToInput(rateOf("executive")));
  const [member, setMember] = useState(pesewasToInput(rateOf("member")));
  const save = useApiMutation(setRates);
  const execP = parseCedi(exec);
  const memberP = parseCedi(member);
  const dirty = execP !== rateOf("executive") || memberP !== rateOf("member");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (execP === null || memberP === null) return;
    save.mutate([semester.id, { executive: execP, member: memberP }], {
      onSuccess: () =>
        flash(
          `Rates saved: executives ${formatCedi(execP)}, members ${formatCedi(memberP)} a week.`,
          "success",
        ),
    });
  }

  return (
    <ListSection
      header="Weekly Dues"
      padded
      footer="A new rate applies to the whole semester, including weeks already past."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 min-[26rem]:grid-cols-2">
          <MoneyField
            label="Executives"
            value={exec}
            onChange={(e) => setExec(e.target.value)}
            disabled={semester.isClosed}
            error={execP === null ? "Enter an amount" : null}
          />
          <MoneyField
            label="Members"
            value={member}
            onChange={(e) => setMember(e.target.value)}
            disabled={semester.isClosed}
            error={memberP === null ? "Enter an amount" : null}
          />
        </div>
        <InlineError error={save.error} />
        {!semester.isClosed && dirty && (
          <Button
            type="submit"
            variant="tinted"
            size="medium"
            loading={save.isPending}
            disabled={execP === null || memberP === null}
          >
            Save Rates
          </Button>
        )}
      </form>
    </ListSection>
  );
}

/**
 * Any officer can name a week (say "Interim Assessment") and choose whether dues are charged
 * for it. The sheet says exactly what the change does to everyone's dues before saving.
 */
function WeekSheet({
  week,
  semester,
  onClose,
}: {
  week: SemesterWeek | null;
  semester: SemesterDetail;
  onClose: () => void;
}) {
  const flash = useFlash();
  return (
    <Sheet open={Boolean(week)} onClose={onClose} title={week ? `Week ${week.weekNo}` : ""}>
      {week && (
        <WeekForm
          key={`${week.id}-${week.counts}-${week.label ?? ""}`}
          week={week}
          semester={semester}
          onDone={(message) => {
            flash(message, "success");
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

type DuesChoice = "dues" | "free";

function WeekForm({
  week,
  semester,
  onDone,
}: {
  week: SemesterWeek;
  semester: SemesterDetail;
  onDone: (message: string) => void;
}) {
  const [label, setLabel] = useState(week.label ?? "");
  const [choice, setChoice] = useState<DuesChoice>(week.counts ? "dues" : "free");
  const save = useApiMutation(setWeekCounts);
  const counts = choice === "dues";
  const duesChanged = counts !== week.counts;
  const labelChanged = label.trim() !== (week.label ?? "");
  const rate = (c: "executive" | "member") =>
    formatCedi(semester.rates.find((r) => r.category === c)?.weeklyAmount ?? 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate([week.id, counts, label.trim()], {
      onSuccess: () =>
        onDone(
          duesChanged
            ? counts
              ? `Week ${week.weekNo}: dues are charged again.`
              : `Week ${week.weekNo} is now a no-dues week.`
            : `Week ${week.weekNo} saved.`,
        ),
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col items-center text-center">
        <IconTile
          icon={counts ? CalendarCheck : CalendarOff}
          color={counts ? "green" : "gray"}
          size="lg"
        />
        <p className="mt-3 text-subhead text-label-2">{formatDay(week.weekStart)}</p>
      </div>
      <TextField
        label="Event or note"
        optional
        maxLength={40}
        hint="Shown on everyone's week-by-week view, e.g. Interim Assessment, Easter break, Show week."
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <Segmented<DuesChoice>
        label="Dues this week"
        value={choice}
        onChange={setChoice}
        options={[
          { value: "dues", label: "Members pay" },
          { value: "free", label: "No dues" },
        ]}
      />
      {duesChanged && (
        <p className="rounded-[0.75rem] bg-cell p-4 text-subhead">
          {counts ? (
            <>
              Dues will be charged for this week: {rate("executive")} for executives and{" "}
              {rate("member")} for members, for everyone whose dues had started by then.
              {week.weekStart <= semester.today
                ? " This week has already begun, so anyone who hasn't paid for it will show as behind straight away."
                : ` It falls due on ${formatDay(week.weekStart)}.`}
            </>
          ) : (
            "Nobody will be charged for this week. Anyone who already paid for it keeps the money as credit for later weeks."
          )}
        </p>
      )}
      <InlineError error={save.error} />
      <Button
        type="submit"
        block
        loading={save.isPending}
        disabled={!duesChanged && !labelChanged}
      >
        Save Week
      </Button>
    </form>
  );
}

function NewSemesterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const flash = useFlash();
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const save = useApiMutation(saveSemester);

  function close() {
    setName("");
    setStartsOn("");
    setEndsOn("");
    save.reset();
    onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate([{ name, startsOn, endsOn }], {
      onSuccess: (s) => {
        flash(
          `${s.name} created with ${s.weeks.length} weeks. Every active member is on the roll from week 1.`,
          "success",
        );
        close();
      },
    });
  }

  return (
    <Sheet open={open} onClose={close} title="New Semester">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Name"
          placeholder="2026/27 Sem 2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="First day"
          type="date"
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
        />
        <TextField
          label="Last day"
          type="date"
          value={endsOn}
          onChange={(e) => setEndsOn(e.target.value)}
        />
        <p className="px-1 text-footnote text-label-2">
          A week is created for every Monday. Rates are copied from the current semester; you can
          change both afterwards.
        </p>
        <InlineError error={save.error} />
        <Button
          type="submit"
          block
          loading={save.isPending}
          disabled={name.trim().length < 2 || !startsOn || !endsOn}
          className="mt-2"
        >
          Create Semester
        </Button>
      </form>
    </Sheet>
  );
}

function CloseSheet({
  open,
  onClose,
  semester,
}: {
  open: boolean;
  onClose: () => void;
  semester: SemesterDetail;
}) {
  const flash = useFlash();
  const close = useApiMutation(closeSemester);
  return (
    <Sheet
      open={open}
      onClose={() => {
        close.reset();
        onClose();
      }}
      title="Close Semester"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center text-center">
          <IconTile icon={Lock} color="orange" size="lg" />
          <p className="mt-3 text-title3 font-bold">Close {semester.name}?</p>
          <p className="mt-1 max-w-[22rem] text-subhead text-label-2">
            No payments, voids or adjustments can be recorded against it afterwards. Members keep
            their statements and receipts. This can't be undone.
          </p>
        </div>
        <InlineError error={close.error} />
        <Button
          block
          loading={close.isPending}
          className="bg-behind text-white active:bg-behind/80"
          onClick={() =>
            close.mutate([semester.id], {
              onSuccess: () => {
                flash(`${semester.name} is closed.`, "success");
                onClose();
              },
            })
          }
        >
          Close Semester
        </Button>
      </div>
    </Sheet>
  );
}
