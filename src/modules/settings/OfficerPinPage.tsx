import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { KeyRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { changePin } from "@/data/api";
import { useApiMutation, useCurrentMember } from "@/data/queries";
import { isWeakPin, WEAK_PIN_MESSAGE } from "@/lib/pin";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { InlineError } from "@/components/States";
import { useFlash } from "@/components/Flash";

/**
 * For someone the Director has just made an officer: they still have their 4-digit member PIN,
 * and choose a 6-digit officer PIN here. The officer screens open as soon as it's saved.
 */
export function OfficerPinPage() {
  const { data: me } = useCurrentMember();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const flash = useFlash();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const change = useApiMutation(changePin);
  const [saved, setSaved] = useState(false);

  if (me && !me.officerPending && !saved) return <Navigate to="/settings" replace />;

  const mismatch = confirm.length === 6 && next !== confirm;

  function submit(e: FormEvent) {
    e.preventDefault();
    change.mutate([current, next], {
      onSuccess: async () => {
        setSaved(true);
        await queryClient.invalidateQueries();
        flash("Officer PIN set. The officer screens are open.", "success");
        navigate("/admin", { replace: true });
      },
    });
  }

  const pinProps = {
    type: "password",
    inputMode: "numeric" as const,
    className: "tnum tracking-[0.4em]",
  };

  return (
    <>
      <PageHeader title="Officer PIN" back={{ to: "/settings", label: "Settings" }} />
      <section className="mb-6 flex flex-col items-center text-center">
        <span className="flex size-16 items-center justify-center rounded-[1.2rem] bg-tint/18 text-tint-text">
          <KeyRound aria-hidden className="size-8" strokeWidth={2.1} />
        </span>
        <h2 className="mt-3 text-title2 font-bold">Set Your Officer PIN</h2>
        <p className="mt-1.5 max-w-[24rem] text-callout text-label-2">
          You've been made an officer. Officers sign in with a 6-digit PIN, which keeps the
          ministry's money records safe. Use it from now on instead of your 4-digit PIN.
        </p>
      </section>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Your current PIN"
          maxLength={4}
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))}
          {...pinProps}
        />
        <TextField
          label="New 6-digit officer PIN"
          hint="Avoid 123456, 111111 or 121212. Cover your screen when you type it."
          maxLength={6}
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))}
          error={next.length === 6 && isWeakPin(next) ? WEAK_PIN_MESSAGE : null}
          {...pinProps}
        />
        <TextField
          label="Confirm officer PIN"
          maxLength={6}
          autoComplete="new-password"
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
          disabled={current.length !== 4 || next.length !== 6 || next !== confirm}
          className="mt-2"
        >
          Save Officer PIN
        </Button>
      </form>
    </>
  );
}
