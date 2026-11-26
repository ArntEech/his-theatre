/** A calendar file (.ics) for one event, so "Add to Calendar" works on any phone. */
export function downloadEvent(title: string, startIso: string, details: string, minutes = 120) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(startIso);
  const end = new Date(start.getTime() + minutes * 60_000);
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//His Theatre//EN",
    "BEGIN:VEVENT",
    `UID:${start.getTime()}-${Math.random().toString(36).slice(2)}@his-theatre`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(details)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "his-theatre-event.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** "Thu 26 Nov · 17:00" in local time. */
export function eventLabel(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${day} · ${time}`;
}

/** "2h", "Yesterday", "3 Nov". */
export function timeAgo(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const mins = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24 && d.getDate() === now.getDate()) return `${hours}h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
