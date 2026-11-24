import { useState, type FormEvent } from "react";
import { changePin } from "@/data/api";
import { useApiMutation, useCurrentMember } from "@/data/queries";
import { isWeakPin, WEAK_PIN_MESSAGE } from "@/lib/pin";
import { isAdmin } from "@/lib/roles";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { Sheet } from "@/components/Sheet";
import { InlineError } from "@/components/States";
import { useFlash } from "@/components/Flash";

/** Change your own PIN. Officers keep (or move up to) a 6-digit PIN; members use 4 digits. */
export function ChangePinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const flash = useFlash();
  const { data: me } = useCurrentMember();
  const officer = isAdmin(me) || Boolean(me?.officerPending);
  const digits = officer ? 6 : 4;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const change = useApiMutation(changePin);
  const mismatch = confirm.length === digits && next !== confirm;

  function close() {
    setCurrent("");
    setNext("");
    setConfirm("");
    change.reset();
    onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    change.mutate([current, next], {
      onSuccess: () => {
        flash("Your PIN has been changed.", "success");
        close();
      },
    });
  }

  const pinProps = {
    type: "password",
    inputMode: "numeric" as const,
    className: "tnum tracking-[0.4em]",
  };

  return (
    <Sheet open={open} onClose={close} title="Change PIN">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Current PIN"
          autoComplete="current-password"
          maxLength={6}
          value={current}
          onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))}
          {...pinProps}
        />
        <TextField
          label="New PIN"
          hint={officer ? "Officers use 6 digits." : "4 digits. Avoid 1234, 1111 or a year."}
          autoComplete="new-password"
          maxLength={digits}
          value={next}
          onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))}
          error={next.length === digits && isWeakPin(next) ? WEAK_PIN_MESSAGE : null}
          {...pinProps}
        />
        <TextField
          label="Confirm new PIN"
          autoComplete="new-password"
          maxLength={digits}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
          error={mismatch ? "The two PINs don't match." : null}
          {...pinProps}
        />
        <InlineError error={change.error} />
        <Button
          type="submit"
          block
          loading={change.isPending}
          disabled={
            (current.length !== 4 && current.length !== 6) ||
            next.length !== digits ||
            next !== confirm
          }
          className="mt-2"
        >
          Save PIN
        </Button>
      </form>
    </Sheet>
  );
}
