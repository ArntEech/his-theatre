import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ChoiceGroup, Field } from "@/components/Field";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as api from "@/data/api";
import { currentMemberQuery, qk } from "@/data/queries";
import type { Member } from "@/data/types";

type Mode = "member" | "activate" | "officer";

export function SignInScreen() {
  const [mode, setMode] = useState<Mode>("member");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function done(member: Member) {
    await queryClient.removeQueries({ queryKey: qk.all });
    queryClient.setQueryData(currentMemberQuery().queryKey, member);
    navigate({ to: "/" });
  }

  return (
    <div className="spotlight flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-10 pt-10">
        <div className="flex flex-col items-center text-center animate-rise">
          <Logo className="h-32 w-24" />
          <p className="eyebrow mt-5">Hearts In Service</p>
          <h1 className="mt-1 text-4xl font-semibold">His Theatre</h1>
          <p className="mt-2 text-lg text-muted-foreground">Your dues, receipts and ministry finances.</p>
        </div>

        <div className="ticket mt-8 p-5 animate-rise">
          <ChoiceGroup<Mode>
            name="How are you signing in?"
            value={mode}
            onChange={setMode}
            options={[
              { value: "member", label: "Member" },
              { value: "activate", label: "First time" },
              { value: "officer", label: "Officer" },
            ]}
          />
          <div className="mt-6">
            {mode === "member" && <MemberForm onDone={done} />}
            {mode === "activate" && <ActivateForm onDone={done} />}
            {mode === "officer" && <OfficerForm onDone={done} />}
          </div>
        </div>

        <Link to="/install" className="mt-5 inline-flex min-h-11 items-center justify-center font-semibold text-gold-text underline decoration-gold-deep underline-offset-4">
          Install the app on this phone
        </Link>

        {api.IS_MOCK && (
          <aside className="mt-6 rounded-xl border-2 border-dashed border-gold-deep p-4 text-base">
            <p className="font-semibold">Test sign-in (test data only, removed when the real database is connected)</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              <li>Members: HIS-010 with PIN {api.DEV_SIGN_IN_HINTS.memberPin}</li>
              <li>First time: {api.DEV_SIGN_IN_HINTS.setupCodes}</li>
              <li>Officers: finsec@histheatre.org / {api.DEV_SIGN_IN_HINTS.officerPassword}, code {api.DEV_SIGN_IN_HINTS.officerCode}</li>
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}

function useSubmit<T>(fn: () => Promise<T>, onDone: (r: T) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone(await fn());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, submit };
}

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg border-2 border-destructive/40 bg-destructive/10 px-3 py-2 font-medium text-destructive">
      {error}
    </p>
  );
}

const pinProps = {
  type: "password",
  inputMode: "numeric",
  pattern: "[0-9]*",
  maxLength: 4,
  autoComplete: "current-password",
  className: "num text-center text-2xl tracking-[0.6em]",
} as const;

function MemberForm({ onDone }: { onDone: (m: Member) => void }) {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const { busy, error, submit } = useSubmit(() => api.signInMember(code, pin), onDone);
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="member-code" label="Member ID" hint="It looks like HIS-012.">
        <Input id="member-code" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" placeholder="HIS-000" required />
      </Field>
      <Field id="member-pin" label="4-digit PIN">
        <Input id="member-pin" {...pinProps} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} required />
      </Field>
      <FormError error={error} />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-muted-foreground">Forgot your PIN? Ask the Financial Secretary for a new setup code.</p>
    </form>
  );
}

function ActivateForm({ onDone }: { onDone: (m: Member) => void }) {
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const { busy, error, submit } = useSubmit(async () => {
    if (pin !== confirm) throw new Error("The two PINs don't match.");
    const member = await api.activateMember(code, setup, pin);
    toast.success("You're all set. Welcome to His Theatre.");
    return member;
  }, onDone);
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-muted-foreground">Use the setup code the Financial Secretary gave you, then choose your own PIN.</p>
      <Field id="act-code" label="Member ID">
        <Input id="act-code" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" placeholder="HIS-000" required />
      </Field>
      <Field id="act-setup" label="Setup code">
        <Input id="act-setup" inputMode="numeric" value={setup} onChange={(e) => setSetup(e.target.value.replace(/\D/g, ""))} maxLength={6} className="num text-xl tracking-widest" required />
      </Field>
      <Field id="act-pin" label="Choose a 4-digit PIN">
        <Input id="act-pin" {...pinProps} autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} required />
      </Field>
      <Field id="act-confirm" label="Type the PIN again">
        <Input id="act-confirm" {...pinProps} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))} required />
      </Field>
      <FormError error={error} />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Setting up…" : "Set up my account"}
      </Button>
    </form>
  );
}

function OfficerForm({ onDone }: { onDone: (m: Member) => void }) {
  const [step, setStep] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [hint, setHint] = useState("");

  const first = useSubmit(() => api.signInOfficer(email, password), (r) => {
    setHint(r.hint);
    setStep("code");
  });
  const second = useSubmit(() => api.verifyOfficerCode(code), onDone);

  if (step === "code") {
    return (
      <form onSubmit={second.submit} className="space-y-4">
        <p className="text-muted-foreground">{hint}</p>
        <Field id="off-code" label="6-digit code">
          <Input id="off-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="num text-center text-2xl tracking-[0.4em]" autoFocus required />
        </Field>
        <FormError error={second.error} />
        <Button type="submit" size="lg" className="w-full" disabled={second.busy}>
          {second.busy ? "Checking…" : "Confirm"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("password")}>
          Use a different account
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={first.submit} className="space-y-4">
      <p className="text-muted-foreground">For the Financial Secretary, Treasurer and Director.</p>
      <Field id="off-email" label="Email">
        <Input id="off-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field id="off-password" label="Password">
        <Input id="off-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <FormError error={first.error} />
      <Button type="submit" size="lg" className="w-full" disabled={first.busy}>
        {first.busy ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
