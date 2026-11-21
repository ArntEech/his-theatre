import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Download, KeyRound, LogOut, Share } from "lucide-react";
import { changePin, signOut } from "@/data/api";
import { isWeakPin, WEAK_PIN_MESSAGE } from "@/lib/pin";
import { useApiMutation, useCurrentMember, useSessionMutation } from "@/data/queries";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Segmented, TextField } from "@/components/Field";
import { IconTile, ListItem, ListRow, ListSection, ValueRow } from "@/components/List";
import { Sheet } from "@/components/Sheet";
import { Avatar } from "@/components/Avatar";
import { ProfileRows } from "@/components/ProfileRows";
import { InlineError } from "@/components/States";
import { useFlash } from "@/components/Flash";
import { roleLabel } from "@/lib/roles";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { useTextSize, type TextSize } from "@/lib/textSize";
import { useInstallPrompt } from "./useInstallPrompt";

export function ProfilePage() {
  const { data: me } = useCurrentMember();
  const navigate = useNavigate();
  const [pinOpen, setPinOpen] = useState(false);
  const out = useSessionMutation(signOut);
  const install = useInstallPrompt();
  const theme = useTheme();
  const text = useTextSize();

  if (!me) return null;

  return (
    <>
      <PageHeader title="Profile" />

      <section className="mb-8 flex flex-col items-center text-center">
        <Avatar name={me.fullName} size="lg" />
        <p className="mt-3 text-title2 font-bold">{me.fullName}</p>
        <p className="text-subhead text-label-2">
          {roleLabel(me)} · {me.memberCode}
        </p>
      </section>

      <ListSection
        header="Details"
        footer="Only you and the officers can see these details. Something wrong? Ask the Financial Secretary to update it."
      >
        <ValueRow label="Member ID" value={me.memberCode} />
        <ValueRow label="Drive" value={me.drive} />
        <ValueRow
          label="Dues category"
          value={me.category === "executive" ? "Executive" : "Member"}
        />
        <ValueRow label="Phone" value={me.phone || "Not given"} />
        <ProfileRows profile={me.profile} />
      </ListSection>

      <ListSection
        header="Appearance"
        footer={
          theme.preference === "system"
            ? `Following your phone, which is set to ${theme.resolved} right now. Saved on this phone only.`
            : `Always ${theme.preference}, whatever your phone is set to. Saved on this phone only.`
        }
      >
        <ListItem>
          <Segmented<ThemePreference>
            label="Light or dark"
            value={theme.preference}
            onChange={theme.setPreference}
            options={[
              { value: "system", label: "Automatic" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </ListItem>
        <ListItem>
          <Segmented<TextSize>
            label="Text size"
            value={text.size}
            onChange={text.setSize}
            options={[
              { value: "standard", label: "Default" },
              { value: "large", label: "Large" },
              { value: "larger", label: "Larger" },
            ]}
          />
        </ListItem>
      </ListSection>

      <ListSection header="Security">
        <ListRow
          leading={<IconTile icon={KeyRound} color="gray" />}
          title="Change PIN"
          onClick={() => setPinOpen(true)}
        />
      </ListSection>

      {!install.standalone && (install.canPrompt || install.isIos) && (
        <ListSection header="App">
          {install.canPrompt && (
            <ListRow
              leading={<IconTile icon={Download} color="blue" />}
              title="Install His Theatre"
              onClick={install.install}
            />
          )}
          {install.isIos && (
            <ListRow
              leading={<IconTile icon={Share} color="blue" />}
              title="Add to Home Screen"
              subtitle="In Safari, tap Share, then Add to Home Screen."
            />
          )}
        </ListSection>
      )}

      <ListSection>
        <ListRow
          action="destructive"
          center
          title={
            <span className="inline-flex items-center gap-2">
              <LogOut aria-hidden className="size-[1.1rem]" />
              {out.isPending ? "Signing Out…" : "Sign Out"}
            </span>
          }
          onClick={() =>
            out.mutate([], { onSuccess: () => navigate("/signin", { replace: true }) })
          }
        />
      </ListSection>

      <ChangePinSheet open={pinOpen} onClose={() => setPinOpen(false)} />
    </>
  );
}

function ChangePinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const flash = useFlash();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const change = useApiMutation(changePin);
  const mismatch = confirm.length === 4 && next !== confirm;

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
    maxLength: 4,
    className: "tnum tracking-[0.4em]",
  };

  return (
    <Sheet open={open} onClose={close} title="Change PIN">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Current PIN"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))}
          {...pinProps}
        />
        <TextField
          label="New PIN"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))}
          error={next.length === 4 && isWeakPin(next) ? WEAK_PIN_MESSAGE : null}
          {...pinProps}
        />
        <TextField
          label="Confirm new PIN"
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
          disabled={current.length !== 4 || next.length !== 4 || next !== confirm}
          className="mt-2"
        >
          Save PIN
        </Button>
      </form>
    </Sheet>
  );
}
