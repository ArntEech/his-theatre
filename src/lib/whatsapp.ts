import { formatDateTime } from "./dates";

/**
 * WhatsApp links for sending receipts and setup codes. Nothing is sent by the app itself:
 * the link opens WhatsApp with the message typed out, and the officer presses Send.
 */

/** A Ghana phone number in the international form WhatsApp wants (233…), or null. */
export function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return `233${digits.slice(1)}`;
  if (/^233\d{9}$/.test(digits)) return digits;
  if (/^\d{9}$/.test(digits)) return `233${digits}`;
  return null;
}

/** Opens a chat with the member if their number is known, otherwise lets the officer pick. */
export function whatsappLink(phone: string, message: string): string {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(message)}`;
}

/** The message that gives someone their Member ID and setup code. */
export function setupCodeMessage(
  p: { fullName: string; memberCode: string; setupCode: string; expiresAt: string },
  appUrl: string,
): string {
  const first = p.fullName.trim().split(/\s+/)[0] ?? p.fullName;
  return [
    `Hello ${first}, welcome to the His Theatre app!`,
    `Your Member ID: ${p.memberCode}\nYour setup code: ${p.setupCode}`,
    `Open ${appUrl}/activate, enter your Member ID and the setup code, then choose your own 4-digit PIN. After that you sign in with your Member ID and PIN.`,
    `The setup code works once and expires ${formatDateTime(p.expiresAt)}. Please don't share it.`,
  ].join("\n\n");
}
