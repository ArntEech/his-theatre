import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { saveMySettings } from "@/data/api";
import { useApiMutation, useCurrentMember, useMySettings } from "@/data/queries";
import type { NotifyKind } from "@/data/community";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Switch } from "@/components/Field";
import { IconTile, ListRow, ListSection } from "@/components/List";
import { InstallSheet } from "@/components/InstallApp";
import { useInstallPrompt } from "@/modules/auth/useInstallPrompt";
import { useFlash } from "@/components/Flash";
import { ErrorNotice, InlineError, LoadingBlock } from "@/components/States";
import { isAdmin } from "@/lib/roles";
import { pushState, turnOffPush, turnOnPush, type PushState } from "@/lib/push";

const KINDS: { kind: NotifyKind; title: string; subtitle: string; officers?: boolean }[] = [
  { kind: "news", title: "New Posts", subtitle: "When officers or your drive head post on News" },
  { kind: "comments", title: "Comments", subtitle: "Comments on your posts and replies to you" },
  { kind: "birthday", title: "Birthdays", subtitle: "Your birthday wishes, and others' birthdays" },
  { kind: "dues", title: "Dues Reminders", subtitle: "Once a week, only if you're behind" },
  { kind: "handovers", title: "Cash to Confirm", subtitle: "When an officer hands you cash", officers: true },
];

const STATE_TEXT: Record<PushState, string> = {
  on: "On for this phone.",
  off: "Off. Turn them on to hear about new posts even when the app is closed.",
  denied: "Blocked. Allow notifications for His Theatre in your phone's settings, then come back here.",
  "needs-install": "On iPhone, notifications work only once His Theatre is on your Home Screen (iOS 16.4 or newer). Add it, open it from there, then turn them on.",
  unsupported: "This browser can't show notifications. Try Chrome on Android, or the installed app on iPhone.",
};

export function NotificationsPage() {
  const { data: me } = useCurrentMember();
  const settings = useMySettings();
  const save = useApiMutation(saveMySettings);
  const flash = useFlash();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const install = useInstallPrompt();

  useEffect(() => {
    void pushState().then(setState);
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      const next = state === "on" ? await turnOffPush() : await turnOnPush();
      setState(next);
      if (next === "on") flash("Notifications are on for this phone.", "success");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't change notifications.", "error");
    } finally {
      setBusy(false);
    }
  }

  const s = settings.data;
  return (
    <>
      <PageHeader title="Notifications" back={{ to: "/settings", label: "Settings" }} />
      <ListSection footer={state ? STATE_TEXT[state] : undefined}>
        <ListRow
          leading={<IconTile icon={BellRing} color="orange" />}
          title="Phone Notifications"
          trailing={
            state === "on" || state === "off" ? (
              <Switch checked={state === "on"} onChange={() => void toggle()} label="Phone notifications" disabled={busy} />
            ) : undefined
          }
        />
      </ListSection>
      {state === "needs-install" && (
        <Button block variant="tinted" className="-mt-4 mb-8" onClick={() => setInstallOpen(true)}>
          How to Add It to Your Home Screen
        </Button>
      )}

      {settings.isPending && <LoadingBlock lines={4} />}
      {settings.isError && <ErrorNotice error={settings.error} onRetry={() => settings.refetch()} />}
      {s && (
        <>
          <ListSection header="What You Get" footer="Urgent posts always come through, whatever you choose here.">
            {KINDS.filter((k) => !k.officers || isAdmin(me)).map((k) => (
              <ListRow
                key={k.kind}
                title={k.title}
                subtitle={k.subtitle}
                trailing={
                  <Switch
                    checked={s.notify[k.kind]}
                    onChange={(v) => save.mutate([{ notify: { ...s.notify, [k.kind]: v } }])}
                    label={k.title}
                  />
                }
              />
            ))}
          </ListSection>
          <ListSection
            header="Your Birthday"
            footer="On your birthday, His Theatre posts a greeting on News so everyone can send wishes. Only the day and month are shown, never your age."
          >
            <ListRow
              title="Birthday Post on News"
              trailing={
                <Switch checked={s.birthdayPost} onChange={(v) => save.mutate([{ birthdayPost: v }])} label="Birthday post on News" />
              }
            />
          </ListSection>
          <InlineError error={save.error} />
        </>
      )}
      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} platform={install.platform} />
    </>
  );
}
