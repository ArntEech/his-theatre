import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { IconButton } from "./Button";

/** One-tap switch between light and dark, for navigation bars. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setPreference } = useTheme();
  const toDark = resolved === "light";
  return (
    <IconButton
      label={toDark ? "Switch to dark mode" : "Switch to light mode"}
      onClick={() => setPreference(toDark ? "dark" : "light")}
      className={className}
    >
      {toDark ? (
        <Moon aria-hidden className="size-[1.4rem]" strokeWidth={2} />
      ) : (
        <Sun aria-hidden className="size-[1.4rem]" strokeWidth={2} />
      )}
    </IconButton>
  );
}
