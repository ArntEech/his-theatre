import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { signInMember } from "@/data/api";
import { useSessionMutation } from "@/data/queries";
import { ApiError } from "@/data/types";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { InlineError } from "@/components/States";
import { InstallAppButton } from "@/components/InstallApp";
import { AuthCover, DevHint, authLink } from "./AuthCover";

export function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [memberCode, setMemberCode] = useState("");
  const [pin, setPin] = useState("");
  const signIn = useSessionMutation(signInMember);
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  function submit(e: FormEvent) {
    e.preventDefault();
    signIn.mutate([memberCode, pin], { onSuccess: () => navigate(from, { replace: true }) });
  }

  const needsActivation = signIn.error instanceof ApiError && signIn.error.code === "not_activated";

  return (
    <>
      <AuthCover title="His Theatre" subtitle="Sign in with your member ID and PIN." />
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Member ID"
          placeholder="HIS-012"
          hint="It's on your membership card."
          value={memberCode}
          onChange={(e) => setMemberCode(e.target.value)}
          autoComplete="username"
          autoCapitalize="characters"
          required
        />
        <TextField
          label="PIN"
          hint="4 digits. Officers use their 6-digit PIN."
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="current-password"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="tnum tracking-[0.4em]"
          required
        />
        <InlineError error={signIn.error} />
        {needsActivation && (
          <Link to="/activate" state={{ memberCode }} className={authLink}>
            Activate My Account
          </Link>
        )}
        <Button
          type="submit"
          block
          loading={signIn.isPending}
          disabled={!memberCode.trim() || (pin.length !== 4 && pin.length !== 6)}
          className="mt-2"
        >
          Sign In
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center">
        <Link to="/activate" className={authLink}>
          First time? Activate your account
        </Link>
        <p className="mt-3 max-w-[18rem] text-center text-footnote text-label-2">
          Forgot your PIN? The Financial Secretary can give you a new setup code.
        </p>
        <InstallAppButton className="mt-6" />
      </div>

      <DevHint>
        <p>Members HIS-004 to HIS-025: PIN 1234. Officers HIS-001 to HIS-003: PIN 258036.</p>
        <p>HIS-019 is locked. HIS-023 and HIS-024 aren't activated (HIS-023 setup code 482913).</p>
      </DevHint>
    </>
  );
}
