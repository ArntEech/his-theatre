import { useState, type FormEvent } from "react";
import { useParams } from "react-router";
import { DoorOpen, KeyRound, LockOpen, Pencil, Plus, Scale, ShieldCheck } from "lucide-react";
import {
  addAdjustment,
  deactivateMember,
  issueSetupCode,
  setRole,
  unlockMember,
  updateMember,
} from "@/data/api";
import { useApiMutation, useCurrentMember, useCurrentSemester, useMember } from "@/data/queries";
import type {
  Member,
  JoinedAs,
  MemberCategory,
  SemesterWeek,
  PaymentRow,
  Position,
  Role,
  SetupCodeResult,
} from "@/data/types";
import { PageHeader } from "@/components/PageHeader";
import { MemberAvatar } from "@/components/Avatar";
import { Button, ButtonLink } from "@/components/Button";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { setupCodeMessage } from "@/lib/whatsapp";
import { MoneyField, Segmented, SelectField, TextAreaField, TextField } from "@/components/Field";
import { IconTile, ListRow, ListSection, ValueRow } from "@/components/List";
import { hasProfile, ProfileRows } from "@/components/ProfileRows";
import { formatBirthday, parseBirthday } from "@/lib/profile";
import { Sheet } from "@/components/Sheet";
import { ContentUnavailable, ErrorNotice, InlineError, LoadingBlock } from "@/components/States";
import { useFlash } from "@/components/Flash";
import { Money } from "@/components/Money";
import { formatCedi, parseCedi } from "@/lib/money";
import { formatDate, formatDateTime, formatDay } from "@/lib/dates";
import { firstName, isDirector } from "@/lib/roles";
import { DuesCard } from "@/modules/dues/DuesCard";
import { PaymentList } from "@/modules/dues/PaymentList";
import { Schedule } from "@/modules/dues/Schedule";
import { AdminReceiptSheet } from "./components/AdminReceiptSheet";
import { MemberTags } from "./components/MemberTags";

type SheetName = "adjust" | "code" | "edit" | "role" | "leave" | null;

export function MemberDetailPage() {
  const { id } = useParams();
  const detail = useMember(id);
  const semester = useCurrentSemester();
  const { data: me } = useCurrentMember();
  const flash = useFlash();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [receipt, setReceipt] = useState<PaymentRow | null>(null);
  const unlock = useApiMutation(unlockMember);
  const d = detail.data;

  if (detail.isError)
    return (
      <>
        <PageHeader back={{ to: "/admin/members", label: "Members" }} title="Member" />
        <ErrorNotice error={detail.error} onRetry={() => detail.refetch()} />
      </>
    );
  if (!d)
    return (
      <>
        <PageHeader back={{ to: "/admin/members", label: "Members" }} title="Member" />
        <LoadingBlock lines={6} />
      </>
    );
  const { member, dues } = d;
  const closed = semester.data?.isClosed;

  return (
    <>
      <PageHeader
        back={{ to: "/admin/members", label: "Members" }}
        overline={`${member.memberCode} · ${member.drive}`}
        title={member.fullName}
      />
      <div className="-mt-1 mb-5 flex flex-col items-center gap-2.5 text-center">
        <MemberAvatar memberId={member.id} name={member.fullName} size="lg" />
        <MemberTags member={member} withCategory />
      </div>

      {dues ? (
        <div className="mb-8">
          <DuesCard dues={dues} label="Dues" meta={semester.data?.name}>
            {!closed && (
              <div className="grid grid-cols-2 gap-2">
                <ButtonLink
                  to={`/admin/pay?member=${member.id}`}
                  size="medium"
                  icon={<Plus aria-hidden className="size-4" strokeWidth={2.6} />}
                >
                  Payment
                </ButtonLink>
                <Button
                  variant="gray"
                  size="medium"
                  icon={<Scale aria-hidden className="size-4" />}
                  onClick={() => setSheet("adjust")}
                >
                  Adjust
                </Button>
              </div>
            )}
          </DuesCard>
        </div>
      ) : (
        <ContentUnavailable
          title="Not on the Roll"
          description="Not on the dues roll for this semester."
        />
      )}

      <PaymentList
        header="Payments"
        payments={d.payments}
        onOpen={setReceipt}
        empty="No payments this semester."
        footer="Tap a receipt to see it or void a mistake."
      />

      {d.adjustments.length > 0 && (
        <ListSection header="Adjustments">
          {d.adjustments.map((a) => (
            <ListRow
              key={a.id}
              title={a.amount < 0 ? "Waiver" : "Extra charge"}
              subtitle={`${a.reason} · ${a.recordedByName}, ${formatDateTime(a.createdAt)}`}
              trailing={<Money value={a.amount} className="text-label" />}
            />
          ))}
        </ListSection>
      )}

      {dues && semester.data && <Schedule weeks={dues.schedule} today={semester.data.today} />}

      <ListSection header="Account">
        <ValueRow label="Phone" value={member.phone || "Not given"} />
        <ValueRow
          label="Sign-in"
          value={
            member.isLocked ? "Locked" : member.isActivated ? "Activated" : "Waiting for setup code"
          }
        />
        <ValueRow
          label="Access"
          value={
            member.role === "super_admin"
              ? "Full access"
              : member.role === "admin"
                ? "Officer"
                : "Member"
          }
        />
        {d.memberSemester && (
          <ValueRow label="Dues start" value={`Week ${d.memberSemester.startWeekNo}`} />
        )}
      </ListSection>

      <ListSection header="Profile">
        {hasProfile(member.profile) ? (
          <ProfileRows profile={member.profile} />
        ) : (
          <ValueRow label="Registration details" value="Not added yet" />
        )}
      </ListSection>

      <ListSection footer={unlock.error ? <InlineError error={unlock.error} /> : undefined}>
        {member.isLocked && (
          <ListRow
            leading={<IconTile icon={LockOpen} color="green" />}
            title={unlock.isPending ? "Unlocking…" : "Unlock Account"}
            action="tint"
            onClick={() =>
              unlock.mutate([member.id], {
                onSuccess: () => flash(`${member.fullName} can sign in again.`, "success"),
              })
            }
          />
        )}
        {member.isActive && member.id !== me?.id && (isDirector(me) || member.role === "member") && (
          <ListRow
            leading={<IconTile icon={KeyRound} color="gold" />}
            title={member.isActivated ? "Reset PIN with a Setup Code" : "Issue a Setup Code"}
            onClick={() => setSheet("code")}
          />
        )}
        <ListRow
          leading={<IconTile icon={Pencil} color="blue" />}
          title="Edit Details"
          onClick={() => setSheet("edit")}
        />
        {isDirector(me) && (
          <ListRow
            leading={<IconTile icon={ShieldCheck} color="charcoal" />}
            title="Role and Office"
            onClick={() => setSheet("role")}
          />
        )}
      </ListSection>

      {member.isActive && member.id !== me?.id && (
        <ListSection>
          <ListRow
            action="destructive"
            center
            title={
              <span className="inline-flex items-center gap-2">
                <DoorOpen aria-hidden className="size-[1.1rem]" /> Mark as Left the Ministry
              </span>
            }
            onClick={() => setSheet("leave")}
          />
        </ListSection>
      )}

      {d.semesterId && (
        <AdjustSheet
          open={sheet === "adjust"}
          onClose={() => setSheet(null)}
          member={member}
          semesterId={d.semesterId}
        />
      )}
      <SetupCodeSheet open={sheet === "code"} onClose={() => setSheet(null)} member={member} />
      <EditSheet
        open={sheet === "edit"}
        onClose={() => setSheet(null)}
        member={member}
        startWeekNo={d.memberSemester?.startWeekNo ?? null}
        weeks={semester.data && !semester.data.isClosed ? semester.data.weeks : []}
      />
      <RoleSheet open={sheet === "role"} onClose={() => setSheet(null)} member={member} />
      <LeaveSheet
        open={sheet === "leave"}
        onClose={() => setSheet(null)}
        member={member}
        today={semester.data?.today ?? ""}
      />
      <AdminReceiptSheet payment={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  member: Member;
}

function AdjustSheet({ open, onClose, member, semesterId }: SheetProps & { semesterId: string }) {
  const flash = useFlash();
  const [kind, setKind] = useState<"waiver" | "charge">("waiver");
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState("");
  const adjust = useApiMutation(addAdjustment);
  const amount = parseCedi(amountText);

  function close() {
    setAmountText("");
    setReason("");
    adjust.reset();
    onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    adjust.mutate(
      [{ memberId: member.id, semesterId, amount: kind === "waiver" ? -amount : amount, reason }],
      {
        onSuccess: () => {
          flash(
            `${kind === "waiver" ? "Waiver" : "Extra charge"} of ${formatCedi(amount)} recorded for ${member.fullName}.`,
            "success",
          );
          close();
        },
      },
    );
  }

  return (
    <Sheet open={open} onClose={close} title="Adjust Dues">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Segmented
          label="Type"
          hideLabel
          value={kind}
          onChange={setKind}
          options={[
            { value: "waiver", label: "Waive Dues" },
            { value: "charge", label: "Add a Charge" },
          ]}
        />
        <MoneyField
          hero
          label="Amount"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          error={amountText && !amount ? "Enter an amount like 5 or 12.50" : null}
        />
        <TextAreaField
          label="Reason"
          hint="For example: hardship waiver approved by the Director."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <p className="px-1 text-footnote text-label-2">
          Adjustments are permanent and appear on {firstName(member.fullName)}'s statement with your
          reason.
        </p>
        <InlineError error={adjust.error} />
        <Button
          type="submit"
          block
          loading={adjust.isPending}
          disabled={!amount || reason.trim().length < 3}
        >
          Record {kind === "waiver" ? "Waiver" : "Charge"}
        </Button>
      </form>
    </Sheet>
  );
}

function SetupCodeSheet({ open, onClose, member }: SheetProps) {
  const [result, setResult] = useState<SetupCodeResult | null>(null);
  const issue = useApiMutation(issueSetupCode);

  function close() {
    setResult(null);
    issue.reset();
    onClose();
  }

  return (
    <Sheet open={open} onClose={close} title="Setup Code">
      {result ? (
        <div className="anim-fade flex flex-col gap-5 text-center">
          <p className="text-subhead text-label-2">
            Give this code to {member.fullName} in person or on WhatsApp. It works once.
          </p>
          <p className="figure rounded-[0.875rem] bg-cell py-6 text-[3.25rem] font-bold tracking-[0.12em]">
            {result.setupCode}
          </p>
          <p className="text-footnote text-label-2">
            They choose “Activate your account” and enter {member.memberCode} with this code.
            Expires {formatDateTime(result.expiresAt)}.
          </p>
          <WhatsAppButton
            phone={member.phone}
            message={setupCodeMessage({ ...member, ...result }, location.origin)}
          >
            Send Code on WhatsApp
          </WhatsAppButton>
          <Button block onClick={close}>
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center text-center">
            <IconTile icon={KeyRound} color="gold" size="lg" />
            <p className="mt-3 max-w-[20rem] text-subhead text-label-2">
              {member.isActivated
                ? `This replaces ${firstName(member.fullName)}'s current PIN. They'll set a new one with the code.`
                : `${firstName(member.fullName)} uses this code to activate the app and choose a PIN.`}
            </p>
          </div>
          <InlineError error={issue.error} />
          <Button
            block
            loading={issue.isPending}
            onClick={() => issue.mutate([member.id], { onSuccess: setResult })}
          >
            Create Setup Code
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function EditSheet({
  open,
  onClose,
  member,
  startWeekNo,
  weeks,
}: SheetProps & { startWeekNo: number | null; weeks: SemesterWeek[] }) {
  const flash = useFlash();
  const [fullName, setFullName] = useState(member.fullName);
  const [phone, setPhone] = useState(member.phone);
  const [drive, setDrive] = useState(member.drive);
  const [category, setCategory] = useState<MemberCategory>(member.category);
  const [portfolio, setPortfolio] = useState(member.portfolio);
  const [startWeek, setStartWeek] = useState(startWeekNo ?? 1);
  const p = member.profile;
  const [birthday, setBirthday] = useState(formatBirthday(p));
  const [level, setLevel] = useState(p.level ? String(p.level) : "");
  const [joinedAs, setJoinedAs] = useState<JoinedAs | "">(p.joinedAs ?? "");
  const [course, setCourse] = useState(p.course);
  const [hall, setHall] = useState(p.hall);
  const [driveInterests, setDriveInterests] = useState(p.driveInterests);
  const [experience, setExperience] = useState(p.experience);
  const [experienceNotes, setExperienceNotes] = useState(p.experienceNotes);
  const [formError, setFormError] = useState<string | null>(null);
  const update = useApiMutation(updateMember);

  function close() {
    setFullName(member.fullName);
    setPhone(member.phone);
    setDrive(member.drive);
    setCategory(member.category);
    setPortfolio(member.portfolio);
    setStartWeek(startWeekNo ?? 1);
    setBirthday(formatBirthday(p));
    setLevel(p.level ? String(p.level) : "");
    setJoinedAs(p.joinedAs ?? "");
    setCourse(p.course);
    setHall(p.hall);
    setDriveInterests(p.driveInterests);
    setExperience(p.experience);
    setExperienceNotes(p.experienceNotes);
    setFormError(null);
    update.reset();
    onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const day = birthday.trim() ? parseBirthday(birthday) : null;
    if (birthday.trim() && !day) {
      setFormError("Write the birthday like 12 April.");
      return;
    }
    setFormError(null);
    const profile = {
      birthDay: day?.birthDay ?? null,
      birthMonth: day?.birthMonth ?? null,
      level: level ? Number(level) : null,
      joinedAs: joinedAs || null,
      course,
      hall,
      driveInterests,
      experience,
      experienceNotes,
    };
    const dues = startWeekNo !== null && weeks.length ? { startWeekNo: startWeek } : {};
    update.mutate([member.id, { fullName, phone, drive, category, portfolio, profile, ...dues }], {
      onSuccess: () => {
        flash("Details saved.", "success");
        onClose();
      },
    });
  }

  return (
    <Sheet open={open} onClose={close} title="Edit Details">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <TextField
          label="Phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <TextField label="Drive" value={drive} onChange={(e) => setDrive(e.target.value)} />
        <TextField
          label="Portfolio"
          optional
          maxLength={60}
          placeholder="e.g. Drama Director"
          hint="Shown under their name. Officer powers are set separately, under Role."
          value={portfolio}
          onChange={(e) => setPortfolio(e.target.value)}
        />
        <Segmented<MemberCategory>
          label="Dues category"
          value={category}
          onChange={setCategory}
          options={[
            { value: "member", label: "Member" },
            { value: "executive", label: "Executive" },
          ]}
        />
        {category !== member.category && (
          <p className="px-1 text-footnote text-label-2">
            The weekly rate for this semester will change to the {category} rate.
          </p>
        )}
        {startWeekNo !== null && weeks.length > 0 && (
          <SelectField
            label="Dues start"
            hint="The week they started coming. They pay from this week on."
            value={String(startWeek)}
            onChange={(e) => setStartWeek(Number(e.target.value))}
          >
            {weeks.map((w) => (
              <option key={w.id} value={w.weekNo}>
                Week {w.weekNo} · {formatDay(w.weekStart)}
                {w.label ? ` · ${w.label}` : ""}
              </option>
            ))}
          </SelectField>
        )}
        <p className="mt-2 px-1 text-footnote font-semibold tracking-wide text-label-2 uppercase">
          Profile
        </p>
        <TextField
          label="Birthday"
          optional
          placeholder="12 April"
          hint="Day and month only."
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
        />
        <TextField
          label="Level"
          optional
          inputMode="numeric"
          placeholder="300"
          value={level}
          onChange={(e) => setLevel(e.target.value.replace(/\D/g, "").slice(0, 3))}
        />
        <Segmented<JoinedAs | "">
          label="Joined as"
          value={joinedAs}
          onChange={setJoinedAs}
          options={[
            { value: "", label: "Not given" },
            { value: "new", label: "New" },
            { value: "continuing", label: "Continuing" },
          ]}
        />
        <TextField label="Course" optional maxLength={120} value={course} onChange={(e) => setCourse(e.target.value)} />
        <TextField label="Hall of residence" optional maxLength={120} value={hall} onChange={(e) => setHall(e.target.value)} />
        <TextField
          label="Drive interests"
          optional
          maxLength={200}
          value={driveInterests}
          onChange={(e) => setDriveInterests(e.target.value)}
        />
        <TextField
          label="Experience"
          optional
          maxLength={60}
          placeholder="Some (church/school)"
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
        />
        <TextField
          label="Experience details"
          optional
          maxLength={500}
          value={experienceNotes}
          onChange={(e) => setExperienceNotes(e.target.value)}
        />
        {formError && <p className="px-1 text-footnote text-destructive">{formError}</p>}
        <InlineError error={update.error} />
        <Button type="submit" block loading={update.isPending} className="mt-2">
          Save
        </Button>
      </form>
    </Sheet>
  );
}

const POSITIONS: Exclude<Position, null>[] = ["Director", "Financial Secretary", "Treasurer"];

function RoleSheet({ open, onClose, member }: SheetProps) {
  const flash = useFlash();
  const [role, setRoleValue] = useState<Role>(member.role);
  const [position, setPosition] = useState<Position>(member.position);
  const save = useApiMutation(setRole);

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate([member.id, role, role === "member" ? null : position], {
      onSuccess: () => {
        flash("Role updated.", "success");
        onClose();
      },
    });
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        save.reset();
        setRoleValue(member.role);
        setPosition(member.position);
        onClose();
      }}
      title="Role and Office"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Segmented<Role>
          label="Access"
          value={role}
          onChange={setRoleValue}
          options={[
            { value: "member", label: "Member" },
            { value: "admin", label: "Officer" },
            { value: "super_admin", label: "Full" },
          ]}
        />
        <p className="px-1 text-footnote text-label-2">
          Officers record money and manage members. Full access also changes roles, sets rates and
          closes semesters. Officers sign in with a 6-digit PIN: if they already use the app, they'll
          be asked to choose one the next time they open it.
        </p>
        {role !== "member" && (
          <SelectField
            label="Office"
            value={position ?? ""}
            onChange={(e) => setPosition((e.target.value || null) as Position)}
          >
            <option value="">No office</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </SelectField>
        )}
        {position && position !== member.position && (
          <p className="px-1 text-footnote text-label-2">
            Whoever holds this office now will be moved off it.
          </p>
        )}
        <InlineError error={save.error} />
        <Button type="submit" block loading={save.isPending} className="mt-2">
          Save
        </Button>
      </form>
    </Sheet>
  );
}

function LeaveSheet({ open, onClose, member, today }: SheetProps & { today: string }) {
  const flash = useFlash();
  const [leftOn, setLeftOn] = useState("");
  const leave = useApiMutation(deactivateMember);
  const date = leftOn || today;

  function submit(e: FormEvent) {
    e.preventDefault();
    leave.mutate([member.id, date], {
      onSuccess: () => {
        flash(`${member.fullName} marked as left on ${formatDate(date)}.`, "success");
        onClose();
      },
    });
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        leave.reset();
        onClose();
      }}
      title="Mark as Left"
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-col items-center text-center">
          <IconTile icon={DoorOpen} color="orange" size="lg" />
          <p className="mt-3 max-w-[20rem] text-subhead text-label-2">
            Weeks after this date won't be charged. Payments and anything still owed stay on record.
            They can no longer sign in.
          </p>
        </div>
        <TextField
          label="Date they left"
          type="date"
          value={date}
          max={today}
          onChange={(e) => setLeftOn(e.target.value)}
        />
        <InlineError error={leave.error} />
        <Button
          type="submit"
          block
          loading={leave.isPending}
          disabled={!date}
          className="bg-behind text-white active:bg-behind/80"
        >
          Mark {firstName(member.fullName)} as Left
        </Button>
      </form>
    </Sheet>
  );
}
