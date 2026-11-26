import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useCurrentMember } from "@/data/queries";
import { Button } from "@/components/Button";
import { firstName } from "@/lib/roles";

const COLORS = ["#E8B931", "#2E9E5B", "#3B7DD8", "#E0663A", "#B05CC8", "#F2D16B"];

/** On your birthday, the first time you open the app that day. */
export function BirthdayPopup() {
  const { data: me } = useCurrentMember();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const key = me ? `his-theatre.birthday-shown.${me.id}` : "";
  const isBirthday =
    Boolean(me) && me!.profile.birthDay === now.getDate() && me!.profile.birthMonth === now.getMonth() + 1;

  useEffect(() => {
    if (!isBirthday) return;
    try {
      if (localStorage.getItem(key) === String(now.getFullYear())) return;
      localStorage.setItem(key, String(now.getFullYear()));
    } catch {
      // Storage blocked: show it anyway.
    }
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBirthday, key]);

  if (!open || !me) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Happy birthday"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-6 backdrop-blur-sm"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 60 }, (_, i) => (
          <span
            key={i}
            className="confetti absolute top-[-5%] block h-3 w-2 rounded-[1px]"
            style={{
              left: `${(i * 37) % 100}%`,
              background: COLORS[i % COLORS.length],
              animationDelay: `${(i % 12) * 0.18}s`,
              animationDuration: `${2.6 + (i % 5) * 0.4}s`,
            }}
          />
        ))}
      </div>
      <div className="anim-fade relative w-full max-w-[22rem] rounded-[1.4rem] bg-cell p-6 text-center shadow-[var(--shadow)]">
        <p className="text-[3.5rem] leading-none">🎂</p>
        <h2 className="mt-3 text-title1 font-bold">Happy birthday, {firstName(me.fullName)}! 🎉</h2>
        <p className="mt-2 text-body text-label-2">From all of us at His Theatre. Wishing you a blessed year ahead.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            block
            onClick={() => {
              setOpen(false);
              navigate("/announcements");
            }}
          >
            See Your Wishes
          </Button>
          <Button block variant="plain" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
