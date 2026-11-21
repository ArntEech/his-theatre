import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { IconButton } from "./Button";

/** One-tap switch between Day and Night, for the sign-in screens. More looks are in Profile. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setPreference } = useTheme();
  const toDark = resolved === "day";
  return (
    <IconButton
      label={toDark ? "Switch to dark mode" : "Switch to light mode"}
      onClick={() => setPreference(toDark ? "night" : "day")}
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
