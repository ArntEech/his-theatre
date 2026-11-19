import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { addMember } from "@/data/api";
import { DRIVES } from "@/lib/drives";
import { useApiMutation, useCurrentSemester, useMembers } from "@/data/queries";
import type { MemberCategory } from "@/data/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Segmented, SelectField, TextField } from "@/components/Field";
import { InlineError } from "@/components/States";
import { useFlash } from "@/components/Flash";
import { formatDay } from "@/lib/dates";
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
  const [startWeekNo, setStartWeekNo] = useState(1);
  const add = useApiMutation(addMember);

  useEffect(() => {
    if (!drive && drives.length) setDrive(drives[0]);
  }, [drives, drive]);
  useEffect(() => {
    if (semester.data?.currentWeekNo) setStartWeekNo(semester.data.currentWeekNo);
  }, [semester.data?.currentWeekNo]);

  const driveValue = drive === NEW_DRIVE ? newDrive.trim() : drive;

  function submit(e: FormEvent) {
    e.preventDefault();
    add.mutate([{ fullName, phone, drive: driveValue, category, startWeekNo }], {
      onSuccess: (m) => {
        flash(
          `${m.memberCode} added. Issue a setup code so ${firstName(m.fullName)} can sign in.`,
          "success",
        );
        navigate(`/admin/members/${m.id}`, { replace: true });
      },
    });
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
          loading={add.isPending}
          disabled={fullName.trim().length < 3 || !driveValue}
          className="mt-2"
        >
          Add Member
        </Button>
      </form>
    </>
  );
}
