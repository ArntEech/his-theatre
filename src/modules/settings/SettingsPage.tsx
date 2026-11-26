import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bell,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Download,
  EllipsisVertical,
  HardDrive,
  KeyRound,
  LogOut,
  MessageCircleQuestion,
  MonitorSmartphone,
  Palette,
  RefreshCw,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useCurrentMember } from "@/data/queries";
import { PageHeader } from "@/components/PageHeader";
import { SearchField } from "@/components/Field";
import { IconTile, ListRow, ListSection, type TileColor } from "@/components/List";
import { MemberAvatar } from "@/components/Avatar";
import { IconButton } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { InstallSheet } from "@/components/InstallApp";
import { useInstallPrompt } from "@/modules/auth/useInstallPrompt";
import { roleLabel } from "@/lib/roles";
import { APP_VERSION } from "@/lib/version";
import { checkForUpdate, restartNow, useAppUpdate, type UpdateStatus } from "@/lib/appUpdate";
import { ChangePinSheet } from "./ChangePinSheet";

interface Item {
  key: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  color: TileColor;
  section: "main" | "security" | "app" | "help";
  /** Extra words people might search for. */
  words: string;
  to?: string;
  onClick?: () => void;
  soon?: boolean;
}

/** Settings in the style of Telegram: your card at the top, then grouped rows, and a search. */
export function SettingsPage() {
  const { data: me } = useCurrentMember();
  const navigate = useNavigate();
  const install = useInstallPrompt();
  const [query, setQuery] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const update = useAppUpdate();

  async function startInstall() {
    if (install.canPrompt && (await install.install())) return;
    setInstallOpen(true);
  }

  const items: Item[] = [
    { key: "account", title: "Account", subtitle: "Your details and Member ID", icon: UserRound, color: "gold", section: "main", words: "profile name phone drive member id details", to: "/profile" },
    { key: "looks", title: "Personalization", subtitle: "Looks, eye care, text size, font", icon: Palette, color: "orange", section: "main", words: "theme day night dark clear blur frosted eye care text size font appearance look", to: "/settings/personalization" },
    { key: "notifications", title: "Notifications", subtitle: "Phone alerts and birthday post", icon: Bell, color: "orange", section: "main", words: "alerts reminders push birthday", to: "/settings/notifications" },
    { key: "pin", title: "Change PIN", icon: KeyRound, color: "gray", section: "security", words: "password pin security", onClick: () => setPinOpen(true) },
    { key: "devices", title: "Devices", subtitle: "Sign out of your other phones", icon: MonitorSmartphone, color: "green", section: "security", words: "phones sessions sign out lost stolen", to: "/settings/devices" },
    { key: "data", title: "Data on This Phone", icon: HardDrive, color: "blue", section: "security", words: "storage offline cache clear saved", to: "/settings/data" },
    {
      key: "update",
      title: update.status === "updating" ? "Updating…" : "Check for Updates",
      subtitle: updateText(update.status, update.lastChecked),
      icon: RefreshCw,
      color: "green",
      section: "app",
      words: "update version new latest refresh old",
      onClick: () => (update.status === "updating" ? restartNow() : void checkForUpdate()),
    },
    ...(install.standalone
      ? []
      : [{ key: "install", title: "Install the App", subtitle: "Put His Theatre on your home screen", icon: Download, color: "gold" as TileColor, section: "app" as const, words: "home screen add download iphone android", onClick: startInstall }]),
    { key: "guide", title: "User Guide", subtitle: "How to use His Theatre", icon: BookOpen, color: "gold", section: "help", words: "help how manual instructions", to: "/settings/guide" },
    { key: "faq", title: "His Theatre FAQ", icon: CircleHelp, color: "blue", section: "help", words: "questions help answers", to: "/settings/faq" },
    { key: "ask", title: "Ask a Question", icon: MessageCircleQuestion, color: "green", section: "help", words: "support contact", soon: true },
    { key: "privacy", title: "Privacy Policy", icon: ShieldCheck, color: "gray", section: "help", words: "data privacy who can see", to: "/settings/privacy" },
    { key: "logout", title: "Log Out", icon: LogOut, color: "gray", section: "help", words: "sign out log out leave", to: "/settings/logout" },
  ];

  const q = query.trim().toLowerCase();
  const found = q
    ? items.filter((i) => `${i.title} ${i.subtitle ?? ""} ${i.words}`.toLowerCase().includes(q))
    : [];

  const row = (i: Item) => (
    <ListRow
      key={i.key}
      leading={<IconTile icon={i.icon} color={i.color} />}
      title={i.title}
      subtitle={i.soon ? undefined : i.subtitle}
      to={i.soon ? undefined : i.to}
      onClick={i.soon ? undefined : i.onClick}
      chevron={!i.soon}
      trailing={i.soon ? <SoonBadge /> : undefined}
    />
  );
  const section = (name: Item["section"]) =>
    items.filter((i) => i.section === name && i.key !== "logout").map(row);

  return (
    <>
      <PageHeader title="Settings" action={<MoreMenu onLogOut={() => navigate("/settings/logout")} />} />

      <div className="mb-5">
        <SearchField value={query} onChange={setQuery} placeholder="Search settings" />
      </div>

      {q ? (
        found.length ? (
          <ListSection>{found.map(row)}</ListSection>
        ) : (
          <p className="py-10 text-center text-callout text-label-2">No settings match "{query}".</p>
        )
      ) : (
        <>
          {me && (
            <ListSection>
              <li>
                <Link
                  to="/profile"
                  className="flex items-center gap-3.5 px-4 py-3.5 transition-colors active:bg-highlight"
                >
                  <MemberAvatar memberId={me.id} name={me.fullName} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-headline font-semibold">{me.fullName}</span>
                    <span className="block truncate text-subhead text-label-2">
                      {roleLabel(me)} · {me.memberCode}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-[1.1rem] shrink-0 text-label-3" strokeWidth={2.6} />
                </Link>
              </li>
            </ListSection>
          )}

          {me?.officerPending && (
            <ListSection footer="You've been made an officer. Choose a 6-digit PIN to open the officer screens.">
              <ListRow
                leading={<IconTile icon={KeyRound} color="gold" />}
                title="Set Your Officer PIN"
                to="/settings/officer-pin"
              />
            </ListSection>
          )}

          <ListSection>{section("main")}</ListSection>
          <ListSection header="Privacy and Security">{section("security")}</ListSection>
          <ListSection footer="The app also checks by itself when you open it and every few minutes, and switches to a new version straight away.">
            {section("app")}
          </ListSection>
          <ListSection header="Help">{section("help")}</ListSection>

          <footer className="mt-2 mb-6 flex flex-col items-center gap-1 text-center">
            <Logo className="w-9 opacity-80" />
            <p className="text-footnote font-semibold text-label-2">His Theatre {APP_VERSION}</p>
            <p className="text-caption text-label-3">Hearts In Service Theatre Ministry</p>
            <p className="text-caption font-medium text-label-3 italic">Commissioned for Missions</p>
          </footer>
        </>
      )}

      <ChangePinSheet open={pinOpen} onClose={() => setPinOpen(false)} />
      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} platform={install.platform} />
    </>
  );
}

function updateText(status: UpdateStatus, lastChecked: number | null): string {
  const when = lastChecked
    ? Date.now() - lastChecked < 90_000
      ? "just now"
      : `${Math.round((Date.now() - lastChecked) / 60_000)} min ago`
    : null;
  switch (status) {
    case "checking":
      return "Checking…";
    case "updating":
      return "Getting the new version. The app restarts by itself, or tap to restart now.";
    case "offline":
      return "You're offline. It checks again when you're back online.";
    case "error":
      return "Couldn't check just now. Tap to try again.";
    case "current":
      return `Version ${APP_VERSION} · up to date${when ? ` (checked ${when})` : ""}`;
    default:
      return `Version ${APP_VERSION}`;
  }
}

export function SoonBadge() {
  return (
    <span className="rounded-full bg-fill px-2 py-0.5 text-caption2 font-semibold text-label-2">
      Coming soon
    </span>
  );
}

/** The ⋮ button in the bar: a small menu, as in Telegram. */
function MoreMenu({ onLogOut }: { onLogOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <IconButton label="More" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <EllipsisVertical aria-hidden className="size-[1.4rem]" strokeWidth={2} />
      </IconButton>
      {open && (
        <div
          role="menu"
          className="material absolute top-11 right-0 z-50 w-48 overflow-hidden rounded-[0.9rem] py-1 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.35)] ring-[0.5px] ring-separator"
        >
          <MenuItem
            icon={<LogOut aria-hidden className="size-[1.1rem]" />}
            onClick={() => {
              setOpen(false);
              onLogOut();
            }}
          >
            Log Out
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-body text-destructive active:bg-highlight"
    >
      {icon}
      {children}
    </button>
  );
}
