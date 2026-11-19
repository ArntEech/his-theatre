/** Ghana numbers: "024 123 4567" → "233241234567". */
export function toInternational(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("233")) return digits;
  if (digits.startsWith("0")) return `233${digits.slice(1)}`;
  return digits;
}

/** Opens WhatsApp with a message ready to send. Nothing is sent until the officer taps Send. */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${toInternational(phone)}?text=${encodeURIComponent(text)}`;
}
