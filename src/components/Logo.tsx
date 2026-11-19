import logoUrl from "@/assets/his-logo.webp";
import { cx } from "@/lib/cx";

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="HIS Theatre Ministry crest"
      className={cx("h-auto select-none", className)}
      draggable={false}
    />
  );
}
