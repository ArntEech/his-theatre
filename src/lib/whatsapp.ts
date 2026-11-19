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
