import { useState } from "react";
import { useNavigate } from "react-router";
import { BookOpen, HardDrive, KeyRound, LogOut, MonitorSmartphone } from "lucide-react";
import { signOut } from "@/data/api";
import { useSessionMutation } from "@/data/queries";
import { PageHeader } from "@/components/PageHeader";
import { IconTile, ListRow, ListSection } from "@/components/List";
import { ChangePinSheet } from "./ChangePinSheet";

/** As in Telegram: before you log out, the things people usually wanted instead. */
export function LogOutPage() {
  const navigate = useNavigate();
  const out = useSessionMutation(signOut);
  const [pinOpen, setPinOpen] = useState(false);

  return (
    <>
      <PageHeader title="Log Out" back={{ to: "/settings", label: "Settings" }} />
      <ListSection header="Instead of logging out, you can">
        <ListRow
          leading={<IconTile icon={KeyRound} color="gray" />}
          title="Change PIN"
          subtitle="If someone else knows your PIN."
          onClick={() => setPinOpen(true)}
        />
        <ListRow
          leading={<IconTile icon={MonitorSmartphone} color="green" />}
          title="Sign Out Other Devices"
          subtitle="If you used your account on someone else's phone."
          to="/settings/devices"
        />
        <ListRow
          leading={<IconTile icon={HardDrive} color="blue" />}
          title="Clear Saved Copy"
          subtitle="If something looks out of date."
          to="/settings/data"
        />
        <ListRow
          leading={<IconTile icon={BookOpen} color="gold" />}
          title="Read the User Guide"
          subtitle="If you're not sure how something works."
          to="/settings/guide"
        />
      </ListSection>
      <ListSection footer="You'll need your Member ID and PIN to sign in again. Signing out removes your records from this phone.">
        <ListRow
          action="destructive"
          center
          title={
            <span className="inline-flex items-center gap-2">
              <LogOut aria-hidden className="size-[1.1rem]" />
              {out.isPending ? "Logging Out…" : "Log Out"}
            </span>
          }
          onClick={() => out.mutate([], { onSuccess: () => navigate("/signin", { replace: true }) })}
        />
      </ListSection>
      <ChangePinSheet open={pinOpen} onClose={() => setPinOpen(false)} />
    </>
  );
}
