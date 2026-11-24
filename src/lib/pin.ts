/**
 * The same PIN rules the database uses (private.pin_problem), so people hear about a weak PIN
 * before anything is sent. Members choose 4 digits; officers choose 6.
 */
const RUNS4 = new Set([
  "0123", "1234", "2345", "3456", "4567", "5678", "6789",
  "9876", "8765", "7654", "6543", "5432", "4321", "3210",
]);
const RUNS6 = new Set([
  "012345", "123456", "234567", "345678", "456789",
  "987654", "876543", "765432", "654321", "543210",
]);

export function isWeakPin(pin: string): boolean {
  if (/^\d{6}$/.test(pin)) {
    if (/^(\d)\1{5}$/.test(pin)) return true;
    if (RUNS6.has(pin)) return true;
    return /^(\d\d)\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin);
  }
  if (!/^\d{4}$/.test(pin)) return true;
  if (/^(\d)\1{3}$/.test(pin)) return true;
  if (RUNS4.has(pin)) return true;
  const n = Number(pin);
  return n >= 1950 && n <= 2030;
}

export const WEAK_PIN_MESSAGE =
  "That PIN is too easy to guess. Avoid 1234, 1111, 123456 and years like 1998.";

/** Officers (Director, Financial Secretary, Treasurer and other admins) use 6 digits. */
export const OFFICER_PIN_DIGITS = 6;
export const MEMBER_PIN_DIGITS = 4;
