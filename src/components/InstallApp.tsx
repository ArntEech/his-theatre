import { useState } from "react";
import { Download, EllipsisVertical, MonitorDown, Share, SquarePlus } from "lucide-react";
import { useInstallPrompt, type InstallPlatform } from "@/modules/auth/useInstallPrompt";
import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { Logo } from "./Logo";
import { cx } from "@/lib/cx";

const STEPS: Record<InstallPlatform, { icon: typeof Share; text: string }[]> = {
  "ios-safari": [
    { icon: Share, text: "Tap the Share button (the square with an arrow pointing up) at the bottom of Safari." },
    { icon: SquarePlus, text: "Scroll down and tap Add to Home Screen." },
    { icon: Download, text: "Tap Add. His Theatre appears on your home screen like any other app." },
  ],
  "ios-other": [
    { icon: Share, text: "Tap the Share button (the square with an arrow pointing up), at the top or bottom of the screen." },
    { icon: SquarePlus, text: "Tap Add to Home Screen. If you don't see it, open his-theatre.vercel.app in Safari and do it there." },
    { icon: Download, text: "Tap Add. His Theatre appears on your home screen like any other app." },
  ],
  android: [
    { icon: EllipsisVertical, text: "Tap the ⋮ menu at the top right of Chrome." },
    { icon: Download, text: "Tap Install app (or Add to Home screen)." },
    { icon: SquarePlus, text: "Tap Install. His Theatre appears with your other apps." },
  ],
  desktop: [
    { icon: MonitorDown, text: "In Chrome or Edge, click the install icon at the right end of the address bar." },
    { icon: Download, text: "Click Install. His Theatre opens in its own window, like a normal program." },
  ],
};

/** A button that installs the app, or explains how on phones that can't install from a button. */
export function InstallAppButton({ className, variant = "link" }: { className?: string; variant?: "link" | "row" }) {
  const install = useInstallPrompt();
  const [open, setOpen] = useState(false);
  if (install.standalone) return null;

  async function start() {
    if (install.canPrompt && (await install.install())) return;
    setOpen(true);
  }

  return (
    <>
      {variant === "link" ? (
        <button
          type="button"
          onClick={start}
          className={cx(
            "inline-flex min-h-11 items-center gap-2 rounded-full bg-fill px-4 text-subhead font-semibold text-tint-text transition-opacity active:opacity-60",
            className,
          )}
        >
          <Download aria-hidden className="size-[1.1rem]" strokeWidth={2.3} />
          Install the App
        </button>
      ) : (
        <button type="button" onClick={start} className={className}>
          Install the App
        </button>
      )}
      <InstallSheet open={open} onClose={() => setOpen(false)} platform={install.platform} />
    </>
  );
}

export function InstallSheet({
  open,
  onClose,
  platform,
}: {
  open: boolean;
  onClose: () => void;
  platform: InstallPlatform;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Install His Theatre">
      <div className="mb-5 flex items-center gap-3">
        <Logo className="w-11" />
        <p className="text-subhead text-label-2">
          Put His Theatre on your home screen. It opens full screen, like a real app, and stays up
          to date by itself.
        </p>
      </div>
      <ol className="mb-6 space-y-3">
        {STEPS[platform].map(({ icon: Icon, text }, i) => (
          <li key={i} className="flex items-start gap-3 rounded-[0.75rem] bg-fill p-3">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-tint text-subhead font-bold text-on-tint">
              {i + 1}
            </span>
            <span className="flex-1 pt-1 text-body">{text}</span>
            <Icon aria-hidden className="mt-1 size-5 shrink-0 text-tint-text" />
          </li>
        ))}
      </ol>
      <Button block variant="gray" onClick={onClose}>
        Done
      </Button>
    </Sheet>
  );
}
