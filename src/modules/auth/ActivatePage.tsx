import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { activateMember } from "@/data/api";
import { isWeakPin, WEAK_PIN_MESSAGE } from "@/lib/pin";
import { useSessionMutation } from "@/data/queries";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { InlineError } from "@/components/States";
import { useFlash } from "@/components/Flash";
import { AuthCover, DevHint, authLink } from "./AuthCover";

export function ActivatePage() {
  const navigate = useNavigate();
  const flash = useFlash();
  const location = useLocation();
  const [memberCode, setMemberCode] = useState(
    (location.state as { memberCode?: string } | null)?.memberCode ?? "",
  );
  const [setupCode, setSetupCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const activate = useSessionMutation(activateMember);

  const mismatch = confirm.length === 4 && pin !== confirm;
  const ready = memberCode.trim() && setupCode.length === 6 && pin.length === 4 && pin === confirm;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    activate.mutate([memberCode, setupCode, pin], {
      onSuccess: () => {
        flash("Welcome to His Theatre. Your PIN is set.", "success");
        navigate("/", { replace: true });
      },
    });
  }

  const pinProps = {
    type: "password",
    inputMode: "numeric" as const,
    maxLength: 4,
    autoComplete: "new-password",
    className: "tnum tracking-[0.4em]",
  };

  return (
    <>
      <AuthCover
        title="Activate"
        subtitle="Enter the 6-digit setup code from the Financial Secretary, then choose your PIN."
      />
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Member ID"
          placeholder="HIS-012"
          value={memberCode}
          onChange={(e) => setMemberCode(e.target.value)}
          autoComplete="username"
          autoCapitalize="characters"
        />
        <TextField
          label="Setup code"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          value={setupCode}
          onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ""))}
          className="tnum tracking-[0.3em]"
        />
        <TextField
          label="New PIN"
          hint="4 digits. Avoid 1234, 1111 or a year."
          error={pin.length === 4 && isWeakPin(pin) ? WEAK_PIN_MESSAGE : null}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          {...pinProps}
        />
        <TextField
          label="Confirm PIN"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
          error={mismatch ? "The two PINs don't match." : null}
          {...pinProps}
        />
        <InlineError error={activate.error} />
        <Button type="submit" block loading={activate.isPending} disabled={!ready} className="mt-2">
          Activate and Sign In
        </Button>
      </form>
      <div className="mt-6 flex justify-center">
        <Link to="/signin" className={authLink}>
          I already have a PIN
        </Link>
      </div>
      <DevHint>
        <p>HIS-023 with setup code 482913. Officers can issue new codes from a member's page.</p>
      </DevHint>
    </>
  );
}
