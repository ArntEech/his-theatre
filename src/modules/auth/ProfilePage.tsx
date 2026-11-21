import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Download, KeyRound, LogOut, Share } from "lucide-react";
import { changePin, signOut } from "@/data/api";
import { isWeakPin, WEAK_PIN_MESSAGE } from "@/lib/pin";
import { useApiMutation, useCurrentMember, useSessionMutation } from "@/data/queries";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Segmented, SelectField, Switch, TextField } from "@/components/Field";
import { IconTile, ListItem, ListRow, ListSection, ValueRow } from "@/components/List";
import { Sheet } from "@/components/Sheet";
import { Avatar } from "@/components/Avatar";
import { ProfileRows } from "@/components/ProfileRows";
import { InlineError } from "@/components/States";
import { useFlash } from "@/components/Flash";
import { roleLabel } from "@/lib/roles";
import { cx } from "@/lib/cx";
import { THEMES, useTheme, type ThemePreference } from "@/lib/theme";
import { useTextSize, type TextSize } from "@/lib/textSize";
import { FONTS, useFont, type FontChoice } from "@/lib/font";
import { useInstallPrompt } from "./useInstallPrompt";

export function ProfilePage() {
  const { data: me } = useCurrentMember();
  const navigate = useNavigate();
  const [pinOpen, setPinOpen] = useState(false);
  const out = useSessionMutation(signOut);
  const install = useInstallPrompt();
  const theme = useTheme();
  const text = useTextSize();
  const font = useFont();

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
        footer="Text size: M is the standard. These choices are saved on this phone only."
      >
        <ListItem>
          <ThemePicker value={theme.preference} onChange={theme.setPreference} />
        </ListItem>
        <ListRow
          title="Eye care"
          subtitle="A warm filter that's kinder to your eyes at night"
          trailing={<Switch label="Eye care" checked={theme.eyeCare} onChange={theme.setEyeCare} />}
        />
        <ListItem>
          <Segmented<TextSize>
            label="Text size"
            value={text.size}
            onChange={text.setSize}
            options={[
              { value: "smaller", label: "XS" },
              { value: "small", label: "S" },
              { value: "standard", label: "M" },
              { value: "large", label: "L" },
              { value: "larger", label: "XL" },
            ]}
          />
        </ListItem>
        <ListItem>
          <SelectField
            label="Font"
            value={font.font}
            onChange={(e) => font.setFont(e.target.value as FontChoice)}
          >
            {(Object.keys(FONTS) as FontChoice[]).map((key) => (
              <option key={key} value={key}>
                {FONTS[key].label}
              </option>
            ))}
          </SelectField>
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

/** Small previews of each look, as in iOS Settings → Wallpaper. */
const SWATCH: Record<ThemePreference, string> = {
  system: "linear-gradient(135deg, #fbf8f1 50%, #343434 50%)",
  day: "#fbf8f1",
  night: "#343434",
  dark: "#000000",
  clear:
    "radial-gradient(70% 60% at 20% 20%, #c8782f, transparent 70%), radial-gradient(60% 60% at 80% 80%, #2f6b6b, transparent 70%), #2a1f1a",
  blur: "radial-gradient(90% 80% at 30% 30%, #9a6a4c, transparent 80%), #4a3428",
  frosted:
    "radial-gradient(80% 70% at 30% 25%, #b9907a, transparent 75%), radial-gradient(70% 70% at 80% 80%, #7d5e6a, transparent 75%), #5c4a44",
};

function ThemePicker({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange: (t: ThemePreference) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Look" className="grid w-full grid-cols-4 gap-x-2 gap-y-3 py-1 sm:grid-cols-7">
      {THEMES.map((t) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={t.hint}
            onClick={() => onChange(t.value)}
            className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
          >
            <span
              className={cx(
                "relative block aspect-[3/4] w-full max-w-[4rem] overflow-hidden rounded-[0.75rem] ring-[0.5px] ring-separator",
                selected && "ring-[2.5px] ring-tint",
              )}
              style={{ background: SWATCH[t.value] }}
            >
              {(t.value === "clear" || t.value === "blur" || t.value === "frosted") && (
                <span
                  className="absolute inset-x-1.5 bottom-1.5 h-1/3 rounded-[0.4rem] border border-white/30"
                  style={{
                    background:
                      t.value === "clear"
                        ? "rgb(255 255 255 / 0.08)"
                        : t.value === "blur"
                          ? "rgb(58 42 34 / 0.5)"
                          : "rgb(255 255 255 / 0.2)",
                    backdropFilter: `blur(${t.value === "clear" ? 2 : t.value === "blur" ? 10 : 6}px)`,
                  }}
                />
              )}
            </span>
            <span
              className={cx(
                "text-caption",
                selected ? "font-semibold text-tint-text" : "text-label-2",
              )}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
