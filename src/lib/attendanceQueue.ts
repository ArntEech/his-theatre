/**
 * Attendance saved on this phone while offline (rehearsal venues often have no signal).
 * Each entry is replayed when the phone is back online. Saving the same ticks twice is safe:
 * the database keeps one record per member per rehearsal.
 */
import type { AttendanceMarkInput } from "@/data/community";

const KEY = "his-theatre.attendance-queue";

export interface QueuedMarks {
  rehearsalId: string;
  label: string;
  marks: AttendanceMarkInput[];
  savedAt: string;
}

export function readQueue(): QueuedMarks[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedMarks[];
  } catch {
    return [];
  }
}

function writeQueue(q: QueuedMarks[]) {
  try {
    if (q.length) localStorage.setItem(KEY, JSON.stringify(q));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage full or blocked: nothing more we can do on this phone.
  }
  window.dispatchEvent(new Event("his-attendance-queue"));
}

export function enqueue(entry: QueuedMarks) {
  const q = readQueue();
  const i = q.findIndex((x) => x.rehearsalId === entry.rehearsalId);
  if (i >= 0) {
    // Merge: the newest tick for each member wins.
    const merged = new Map(q[i].marks.map((m) => [m.memberId, m]));
    for (const m of entry.marks) merged.set(m.memberId, m);
    q[i] = { ...entry, marks: [...merged.values()] };
  } else q.push(entry);
  writeQueue(q);
}

export function pendingFor(rehearsalId: string): AttendanceMarkInput[] {
  return readQueue().find((x) => x.rehearsalId === rehearsalId)?.marks ?? [];
}

let flushing = false;

/** Sends what's waiting. Returns how many rehearsals were sent; failures stay queued. */
export async function flushQueue(
  send: (rehearsalId: string, marks: AttendanceMarkInput[]) => Promise<unknown>,
): Promise<{ sent: number; failed: { label: string; error: unknown }[] }> {
  if (flushing) return { sent: 0, failed: [] };
  flushing = true;
  let sent = 0;
  const failed: { label: string; error: unknown }[] = [];
  try {
    for (const entry of readQueue()) {
      try {
        await send(entry.rehearsalId, entry.marks);
        writeQueue(readQueue().filter((x) => x.rehearsalId !== entry.rehearsalId));
        sent++;
      } catch (error) {
        const offline = error instanceof Error && /offline|connection/i.test(error.message);
        if (offline) break;
        // The server refused (e.g. the day closed): drop it so it doesn't retry forever.
        writeQueue(readQueue().filter((x) => x.rehearsalId !== entry.rehearsalId));
        failed.push({ label: entry.label, error });
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, failed };
}
