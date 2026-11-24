import { useState } from "react";
import { HardDrive, Palette, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { IconTile, ListRow, ListSection } from "@/components/List";
import { useFlash } from "@/components/Flash";

const CACHE_KEY = "his-theatre.cache";

function sizeOf(predicate: (key: string) => boolean): number {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && predicate(key)) bytes += (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2;
    }
  } catch {
    /* storage unavailable */
  }
  return bytes;
}

const kb = (bytes: number) => (bytes < 1024 ? `${bytes} bytes` : `${Math.round(bytes / 1024)} KB`);

/** What His Theatre keeps on this phone, and a way to clear it without signing out. */
export function DataPage() {
  const queryClient = useQueryClient();
  const flash = useFlash();
  const [, rerender] = useState(0);
  const saved = sizeOf((k) => k === CACHE_KEY);
  const prefs = sizeOf((k) => k.startsWith("his-theatre.") && k !== CACHE_KEY);

  function clear() {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
    queryClient.invalidateQueries();
    rerender((n) => n + 1);
    flash("Saved copy cleared. Everything has been loaded fresh.", "success");
  }

  return (
    <>
      <PageHeader title="Data on This Phone" back={{ to: "/settings", label: "Settings" }} />
      <ListSection
        header="Stored Here"
        footer="The saved copy lets you see your dues when there's no connection. It's replaced with fresh data every time you open the app, and removed for others when you sign out."
      >
        <ListRow
          leading={<IconTile icon={HardDrive} color="blue" />}
          title="Saved copy for offline use"
          trailing={<span className="tnum">{kb(saved)}</span>}
        />
        <ListRow
          leading={<IconTile icon={Palette} color="orange" />}
          title="Your look, text size and font"
          trailing={<span className="tnum">{kb(prefs)}</span>}
        />
      </ListSection>
      <ListSection footer="Something looks out of date? This clears the saved copy and loads everything again. You stay signed in.">
        <ListRow
          leading={<IconTile icon={RefreshCw} color="gold" />}
          title="Clear Saved Copy"
          action="tint"
          onClick={clear}
        />
      </ListSection>
    </>
  );
}
