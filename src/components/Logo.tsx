import { cn } from "@/lib/utils";

/** The ministry logo, served from public/brand/ (no outside hosting). */
export function Logo({ className }: { className?: string }) {
  return <img src="/brand/his-logo.png" alt="HIS Theatre Ministry" className={cn("object-contain", className)} />;
}
