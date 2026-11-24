import { useState } from "react";
import { MonitorSmartphone, Smartphone } from "lucide-react";
import { signOutOtherDevices } from "@/data/api";
import { useApiMutation } from "@/data/queries";
import { PageHeader } from "@/components/PageHeader";
import { IconTile, ListRow, ListSection } from "@/components/List";
import { InlineError } from "@/components/States";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { useFlash } from "@/components/Flash";

function thisDevice(): string {
  const ua = navigator.userAgent;
  const device = /iphone/i.test(ua)
    ? "iPhone"
    : /ipad/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
      ? "iPad"
      : /android/i.test(ua)
        ? "Android phone"
        : /windows/i.test(ua)
          ? "Windows computer"
          : /macintosh/i.test(ua)
            ? "Mac"
            : "This device";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /crios|chrome/i.test(ua)
      ? "Chrome"
      : /fxios|firefox/i.test(ua)
        ? "Firefox"
        : /safari/i.test(ua)
          ? "Safari"
          : "browser";
  const app = window.matchMedia("(display-mode: standalone)").matches ? "the installed app" : browser;
  return `${device} · ${app}`;
}

export function DevicesPage() {
  const flash = useFlash();
  const [confirm, setConfirm] = useState(false);
  const others = useApiMutation(signOutOtherDevices);

  return (
    <>
      <PageHeader title="Devices" back={{ to: "/settings", label: "Settings" }} />
      <ListSection header="This Device">
        <ListRow
          leading={<IconTile icon={Smartphone} color="green" />}
          title={thisDevice()}
          subtitle="Signed in now"
        />
      </ListSection>
      <ListSection footer="Signs your account out on every other phone and computer. This one stays signed in. Lost your phone? Do this, then ask the Financial Secretary for a new setup code to change your PIN.">
        <ListRow
          leading={<IconTile icon={MonitorSmartphone} color="orange" />}
          title="Sign Out of All Other Devices"
          action="destructive"
          onClick={() => setConfirm(true)}
        />
      </ListSection>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Sign out other devices?">
        <p className="mb-5 text-body text-label-2">
          Anyone using your account on another phone or computer will be signed out straight away.
        </p>
        <InlineError error={others.error} />
        <Button
          block
          variant="destructive"
          loading={others.isPending}
          onClick={() =>
            others.mutate([], {
              onSuccess: () => {
                setConfirm(false);
                flash("Signed out of all other devices.", "success");
              },
            })
          }
        >
          Sign Out Other Devices
        </Button>
      </Sheet>
    </>
  );
}
