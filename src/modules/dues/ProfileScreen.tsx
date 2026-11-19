import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Field } from "@/components/Field";
import { SecretInput } from "@/components/SecretInput";
import { FormSheet } from "@/components/FormSheet";
import { PageHeader, SectionTitle } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as api from "@/data/api";
import { currentMemberQuery, qk } from "@/data/queries";

export function ProfileScreen() {
  const { data: me } = useSuspenseQuery(currentMemberQuery());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pinOpen, setPinOpen] = useState(false);

  if (!me) return null;

  async function handleSignOut() {
    await api.signOut();
    queryClient.removeQueries({ queryKey: qk.all });
    navigate({ to: "/sign-in" });
  }

  const rows: [string, string][] = [
    ["Member ID", me.memberCode],
    ["Phone", me.phone],
    ["Drive", me.drive],
    ["Dues group", me.category === "executive" ? "Executive" : "Member"],
    ...(me.position ? ([["Office", me.position]] as [string, string][]) : []),
  ];

  return (
    <div>
      <PageHeader eyebrow="Profile" title={me.fullName} />
      <dl className="ticket divide-y divide-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-muted-foreground">Something wrong here? Ask the Financial Secretary to correct it.</p>

      <SectionTitle>Security</SectionTitle>
      <div className="space-y-3">
        <Button variant="outline" className="w-full" onClick={() => setPinOpen(true)}>
          Change my PIN
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link to="/install">Install the app on this phone</Link>
        </Button>
        <Button variant="stage" className="w-full" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>

      <ChangePinSheet open={pinOpen} onOpenChange={setPinOpen} />
    </div>
  );
}

function ChangePinSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("The two new PINs don't match.");
      return;
    }
    setBusy(true);
    try {
      await api.changePin(current, next);
      toast.success("Your PIN has been changed.");
      setCurrent("");
      setNext("");
      setConfirm("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change your PIN.");
    } finally {
      setBusy(false);
    }
  }

  const pin = { inputMode: "numeric", maxLength: 4, className: "num text-center text-2xl tracking-[0.6em]" } as const;
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title="Change my PIN">
      <form onSubmit={submit} className="space-y-4">
        <Field id="pin-current" label="Current PIN">
          <SecretInput id="pin-current" {...pin} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))} required />
        </Field>
        <Field id="pin-new" label="New 4-digit PIN">
          <SecretInput id="pin-new" {...pin} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))} required />
        </Field>
        <Field id="pin-confirm" label="Type the new PIN again">
          <SecretInput id="pin-confirm" {...pin} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))} required />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Save new PIN"}
        </Button>
      </form>
    </FormSheet>
  );
}
