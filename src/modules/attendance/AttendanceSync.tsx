import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { markAttendance } from "@/data/api";
import { useFlash } from "@/components/Flash";
import { flushQueue, readQueue } from "@/lib/attendanceQueue";
import { isOnline } from "@/lib/online";

/** Sends attendance saved offline as soon as the phone is back online. */
export function AttendanceSync() {
  const flash = useFlash();
  const queryClient = useQueryClient();
  useEffect(() => {
    const run = async () => {
      if (!isOnline() || readQueue().length === 0) return;
      const { sent, failed } = await flushQueue(markAttendance);
      if (sent) {
        flash(`Attendance saved offline has been sent (${sent} ${sent === 1 ? "rehearsal" : "rehearsals"}).`, "success");
        void queryClient.invalidateQueries();
      }
      for (const f of failed)
        flash(`Attendance for ${f.label} couldn't be sent: ${f.error instanceof Error ? f.error.message : "try again"}`, "error");
    };
    void run();
    window.addEventListener("online", run);
    const timer = setInterval(run, 60_000);
    return () => {
      window.removeEventListener("online", run);
      clearInterval(timer);
    };
  }, [flash, queryClient]);
  return null;
}
