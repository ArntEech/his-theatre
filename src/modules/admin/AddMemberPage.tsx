import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { addMember, issueSetupCode } from "@/data/api";
import { DRIVES } from "@/lib/drives";
import { useApiMutation, useCurrentSemester, useMembers } from "@/data/queries";
import type { Member, MemberCategory, SetupCodeResult } from "@/data/types";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { setupCodeMessage } from "@/lib/whatsapp";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Segmented, SelectField, TextField } from "@/components/Field";
import { InlineError } from "@/components/States";
import { useFlash } from "@/components/Flash";
import { formatDateTime, formatDay } from "@/lib/dates";
import { firstName } from "@/lib/roles";

const NEW_DRIVE = "__new__";

export function AddMemberPage() {
  const navigate = useNavigate();
  const flash = useFlash();
  const semester = useCurrentSemester();
  const all = useMembers({ includeInactive: true });
  const drives = useMemo(
    () => [
      ...new Set([...DRIVES, ...(all.data ?? []).map((i) => i.member.drive).filter(Boolean)]),
    ],
    [all.data],
  );

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [drive, setDrive] = useState("");
  const [newDrive, setNewDrive] = useState("");
  const [category, setCategory] = useState<MemberCategory>("member");
  const [portfolio, setPortfolio] = useState("");
  const [startWeekNo, setStartWeekNo] = useState(1);
  const add = useApiMutation(addMember);
  const code = useApiMutation(issueSetupCode);
  const [added, setAdded] = useState<(SetupCodeResult & { member: Member }) | null>(null);

  useEffect(() => {
    if (!drive && drives.length) setDrive(drives[0]);
  }, [drives, drive]);
  useEffect(() => {
    if (semester.data?.currentWeekNo) setStartWeekNo(semester.data.currentWeekNo);
  }, [semester.data?.currentWeekNo]);

  const driveValue = drive === NEW_DRIVE ? newDrive.trim() : drive;

  function submit(e: FormEvent) {
    e.preventDefault();
    add.mutate([{ fullName, phone, drive: driveValue, category, portfolio, startWeekNo }], {
      onSuccess: (m) => {
        // Every new member gets their setup code straight away, ready to send.
        code.mutate([m.id], {
          onSuccess: (result) => setAdded({ member: m, ...result }),
          onError: () => {
            flash(
              `${m.memberCode} added. Open their page to issue a setup code.`,
              "success",
            );
            navigate(`/admin/members/${m.id}`, { replace: true });
          },
        });
      },
    });
  }

  if (added) {
    const { member: m, setupCode, expiresAt } = added;
    return (
      <>
        <PageHeader back={{ to: "/admin/members", label: "Members" }} title="Member Added" />
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-title3 font-bold">{m.fullName}</p>
          <p className="text-subhead text-label-2">Member ID {m.memberCode}</p>
          <p className="mt-4 text-footnote text-label-2">Setup code</p>
          <p className="tnum font-mono text-[2.5rem] font-bold tracking-[0.3em] select-all">
            {setupCode}
          </p>
          <p className="max-w-[22rem] text-footnote text-label-2">
            Shown only now. Works once, until {formatDateTime(expiresAt)}. {firstName(m.fullName)}{" "}
            uses it with their Member ID to choose a 4-digit PIN.
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <WhatsAppButton
            phone={m.phone}
            message={setupCodeMessage({ ...m, setupCode, expiresAt }, location.origin)}
          >
            Send ID and Code on WhatsApp
          </WhatsAppButton>
          <Button block onClick={() => navigate(`/admin/members/${m.id}`, { replace: true })}>
            Done
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader back={{ to: "/admin/members", label: "Members" }} title="New Member" />
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="off"
        />
        <TextField
          label="Phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          optional
        />
        <SelectField label="Drive" value={drive} onChange={(e) => setDrive(e.target.value)}>
          {drives.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
          <option value={NEW_DRIVE}>New drive…</option>
        </SelectField>
        {drive === NEW_DRIVE && (
          <TextField
            label="New drive name"
            value={newDrive}
            onChange={(e) => setNewDrive(e.target.value)}
          />
        )}
        <Segmented<MemberCategory>
          label="Dues category"
          value={category}
          onChange={setCategory}
          options={[
            { value: "member", label: "Member" },
            { value: "executive", label: "Executive" },
          ]}
        />
        {category === "executive" && (
          <TextField
            label="Portfolio"
            optional
            maxLength={60}
            placeholder="e.g. Drama Director"
            hint="Shown under their name."
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
          />
        )}
        {semester.data && (
          <SelectField
            label="Dues start from"
            hint={`Weeks before this aren't charged in ${semester.data.name}.`}
            value={startWeekNo}
            onChange={(e) => setStartWeekNo(Number(e.target.value))}
          >
            {semester.data.weeks.map((w) => (
              <option key={w.id} value={w.weekNo}>
                Week {w.weekNo} · {formatDay(w.weekStart)}
                {w.counts ? "" : ` (${w.label ?? "no dues"})`}
              </option>
            ))}
          </SelectField>
        )}
        <InlineError error={add.error} />
        <Button
          type="submit"
          block
          loading={add.isPending || code.isPending}
          disabled={fullName.trim().length < 3 || !driveValue}
          className="mt-2"
        >
          Add Member
        </Button>
      </form>
    </>
  );
}
