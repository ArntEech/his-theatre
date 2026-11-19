import { MessageCircle } from "lucide-react";
import { buttonClass } from "./Button";
import { cx } from "@/lib/cx";
import { whatsappLink } from "@/lib/whatsapp";

/** Opens WhatsApp with the message ready; the officer checks it and presses Send. */
export function WhatsAppButton({
  phone,
  message,
  children = "Send on WhatsApp",
  className,
}: {
  phone: string;
  message: string;
  children?: string;
  className?: string;
}) {
  return (
    <a
      href={whatsappLink(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClass("gray", "large", cx("w-full gap-2", className))}
    >
      <MessageCircle aria-hidden className="size-5" />
      {children}
    </a>
  );
}
