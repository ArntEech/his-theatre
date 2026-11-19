import { Link } from "@tanstack/react-router";
import { CheckCircle2, Download, MoreVertical, PlusSquare, Share } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** How to put His Theatre on the home screen. No app store needed. */
export function InstallScreen() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isInstalled());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pb-10 pt-10">
      <div className="flex items-center gap-3 animate-rise">
        <Logo className="h-16 w-12" />
        <div>
          <p className="eyebrow">HIS Theatre Ministry</p>
          <h1 className="text-3xl font-semibold">Install His Theatre</h1>
        </div>
      </div>
      <p className="mt-4 text-lg">It works like a normal app: an icon on your home screen, full screen, no app store.</p>

      {installed ? (
        <div className="mt-6 rounded-xl border-2 border-status-paid/50 bg-status-paid/10 p-5">
          <p className="flex items-center gap-2 text-xl font-semibold text-status-paid">
            <CheckCircle2 aria-hidden /> Installed
          </p>
          <p className="mt-1">Open His Theatre from your home screen.</p>
        </div>
      ) : platform === "ios" ? (
        <ol className="mt-6 space-y-3">
          <Step n={1} icon={<span className="font-display text-lg font-semibold">S</span>}>
            Open this page in <b>Safari</b>. Other browsers on iPhone can't install apps.
          </Step>
          <Step n={2} icon={<Share />}>
            Tap the <b>Share</b> button at the bottom of the screen.
          </Step>
          <Step n={3} icon={<PlusSquare />}>
            Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.
          </Step>
        </ol>
      ) : prompt ? (
        <Button size="lg" className="mt-6 w-full" onClick={install}>
          <Download aria-hidden /> Install His Theatre
        </Button>
      ) : (
        <ol className="mt-6 space-y-3">
          <Step n={1} icon={<span className="font-display text-lg font-semibold">C</span>}>
            Open this page in <b>Chrome</b>.
          </Step>
          <Step n={2} icon={<MoreVertical />}>
            Tap the <b>⋮</b> menu at the top right.
          </Step>
          <Step n={3} icon={<Download />}>
            Tap <b>Install app</b> or <b>Add to Home screen</b>.
          </Step>
        </ol>
      )}

      <Button asChild variant="outline" size="lg" className="mt-auto w-full">
        <Link to="/">Continue in the browser</Link>
      </Button>
    </main>
  );
}

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold text-primary-foreground [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <p className="text-lg">
        <span className="sr-only">Step {n}: </span>
        {children}
      </p>
    </li>
  );
}
