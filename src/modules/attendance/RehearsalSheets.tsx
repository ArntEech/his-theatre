import { useState, type FormEvent } from "react";
import { addRehearsal, cancelRehearsal } from "@/data/api";
import { useApiMutation } from "@/data/queries";
import type { Rehearsal } from "@/data/community";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { SelectField, TextAreaField, TextField } from "@/components/Field";
import { ListRow } from "@/components/List";
import { useFlash } from "@/components/Flash";
import { InlineError } from "@/components/States";
import { formatDateLong, formatDay } from "@/lib/dates";

/** Add a one-off rehearsal. Officers: for everyone or one drive. Drive heads: their drive. */
export function AddRehearsalSheet({
  open,
  onClose,
  today,
  drives,
  isOfficer,
}: {
  open: boolean;
  onClose: () => void;
  today: string;
  drives: string[];
  isOfficer: boolean;
}) {
  const [heldOn, setHeldOn] = useState(today);
  const [drive, setDrive] = useState(isOfficer ? "" : (drives[0] ?? ""));
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const add = useApiMutation(addRehearsal);
  const flash = useFlash();
  function submit(e: FormEvent) {
    e.preventDefault();
    add.mutate([{ heldOn, drive: drive || null, title, startsAt: startsAt || null }], {
      onSuccess: () => {
        flash(`Rehearsal added for ${formatDay(heldOn)}.`, "success");
        setTitle("");
        setStartsAt("");
        onClose();
      },
    });
  }
  return (
    <Sheet open={open} onClose={() => { add.reset(); onClose(); }} title="Add a Rehearsal">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Date" type="date" value={heldOn} min={today} onChange={(e) => setHeldOn(e.target.value)} />
        <TextField label="Time" type="time" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} optional />
        <SelectField label="For" value={drive} onChange={(e) => setDrive(e.target.value)}>
          {isOfficer && <option value="">Everyone</option>}
          {drives.map((d) => (
            <option key={d} value={d}>
              {d} only
            </option>
          ))}
        </SelectField>
        <TextField
          label="Name"
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Saturday booster"
          optional
        />
        <InlineError error={add.error} />
        <Button type="submit" block loading={add.isPending} disabled={!heldOn}>
          Add Rehearsal
        </Button>
      </form>
    </Sheet>
  );
}

/** Cancel (or restore) one rehearsal. Cancelling posts a notice on News. */
export function RehearsalActionSheet({
  rehearsal,
  onClose,
  canChange,
}: {
  rehearsal: Rehearsal | null;
  onClose: () => void;
  canChange: boolean;
}) {
  const [reason, setReason] = useState("");
  const change = useApiMutation(cancelRehearsal);
  const flash = useFlash();
  const r = rehearsal;
  function act(cancel: boolean) {
    if (!r) return;
    change.mutate([r.id, reason, cancel], {
      onSuccess: () => {
        flash(cancel ? "Rehearsal cancelled. A notice is on News." : "Rehearsal restored.", "success");
        setReason("");
        onClose();
      },
    });
  }
  return (
    <Sheet open={Boolean(r)} onClose={() => { change.reset(); onClose(); }} title={r ? formatDateLong(r.heldOn) : ""}>
      {r && (
        <div className="flex flex-col gap-4">
          <ul className="overflow-hidden rounded-[0.75rem] bg-cell">
            <ListRow title="Rehearsal" trailing={r.title || (r.kind === "extra" ? "Extra" : "Regular")} />
            <ListRow title="For" trailing={r.drive ?? "Everyone"} />
            {r.startsAt && <ListRow title="Time" trailing={r.startsAt} />}
            {r.isCancelled && <ListRow title="Cancelled" subtitle={r.cancelReason ?? "No reason given"} />}
          </ul>
          {canChange && !r.isCancelled && (
            <>
              <TextAreaField
                label="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="Church programme in the auditorium"
                optional
              />
              <InlineError error={change.error} />
              <Button variant="destructive" block loading={change.isPending} onClick={() => act(true)}>
                Cancel This Rehearsal
              </Button>
              <p className="px-1 text-footnote text-label-2">
                Nobody is marked absent, and a notice goes out on News to the people it was for.
              </p>
            </>
          )}
          {canChange && r.isCancelled && (
            <>
              <InlineError error={change.error} />
              <Button variant="gray" block loading={change.isPending} onClick={() => act(false)}>
                Restore This Rehearsal
              </Button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
