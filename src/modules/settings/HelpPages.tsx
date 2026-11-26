import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useCurrentMember } from "@/data/queries";
import { isAdmin, isDirector } from "@/lib/roles";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Field";
import { ListSection } from "@/components/List";

const back = { to: "/settings", label: "Settings" };

type GuideRole = "member" | "officer" | "director";

interface Topic {
  title: string;
  steps: string[];
}

const GUIDES: Record<GuideRole, Topic[]> = {
  member: [
    {
      title: "Getting in for the first time",
      steps: [
        "An officer sends you your Member ID and a 6-digit setup code on WhatsApp.",
        "Open his-theatre.vercel.app and tap “First time? Activate your account”.",
        "Enter your Member ID and the setup code, choose “A member”, then pick a 4-digit PIN.",
        "The code works once and lasts 7 days. If it runs out, ask for a new one.",
      ],
    },
    {
      title: "Signing in",
      steps: [
        "Enter your Member ID (it's on your membership card, e.g. HIS-012) and your PIN.",
        "Five wrong tries means a 15-minute wait. Ten locks the account until an officer unlocks it.",
        "Forgot your PIN? The Financial Secretary gives you a new setup code and you choose a new PIN.",
      ],
    },
    {
      title: "Your dues",
      steps: [
        "Home shows whether you're Paid up, Behind or Paid ahead, and which week of the semester it is.",
        "Dues shows every week: Paid, Upcoming, or No dues (weeks like Interim Assessment).",
        "Executives pay GH₵10 a week, members GH₵5, unless the Director changes the rates.",
      ],
    },
    {
      title: "Paying",
      steps: [
        "Cash: hand it to the Financial Secretary at rehearsal.",
        "Mobile Money: send it to the ministry number, then show the Financial Secretary the transaction ID.",
        "Every payment gets a receipt number (like R-0012). It appears in the app straight away. Tap it to see the details.",
      ],
    },
    {
      title: "Installing the app",
      steps: [
        "iPhone: in Safari, tap Share, then Add to Home Screen.",
        "Android: in Chrome, tap ⋮, then Install app.",
        "Or tap Settings → Install the App, which shows the steps for your phone.",
      ],
    },
    {
      title: "Attendance",
      steps: [
        "Rehearsals are every Tuesday and Thursday. Your drive head or an officer marks you Present, Late, Excused or Absent.",
        "Home shows this month's rehearsals and your streak. Attendance shows the calendar and your rate.",
        "Can't make it? On Attendance, tap “I Can't Come” before the rehearsal and give a reason. If it's approved, it won't count against you.",
        "A mark looks wrong? Speak to your drive head or an officer. They can correct it until the end of that week.",
      ],
    },
    {
      title: "News",
      steps: [
        "News has posts from the officers and your drive head. Tap a tag like Dues or Event to see only those.",
        "Like, comment, reply and share. Report a comment that isn't right, and the officers will look at it.",
        "A red dot on News means new posts. Turn on phone notifications in Settings → Notifications.",
        "On your birthday His Theatre posts a greeting. You can turn that off in Settings → Notifications.",
      ],
    },
    {
      title: "Making it yours",
      steps: [
        "Settings → Personalization: Day, Night, Dark and three glass looks, eye care for late nights, five text sizes and seven fonts.",
        "The moon or sun at the top switches Day and Night with one tap.",
      ],
    },
  ],
  officer: [
    {
      title: "Your officer PIN",
      steps: [
        "Officers sign in with a 6-digit PIN instead of 4 digits. That one PIN opens the officer screens.",
        "First time: activate with the setup code from the Director and choose “An officer”.",
        "Already a member and just made an officer? Home shows “Set Your Officer PIN”. Do it once.",
        "Cover your screen when typing it. Anyone who sees it can act as you.",
      ],
    },
    {
      title: "Recording a payment",
      steps: [
        "Admin → Record Payment (or the gold button). Search the person, enter the amount, choose Cash or MoMo.",
        "A receipt is issued straight away and the member sees it on their phone.",
        "A mistake? Open the receipt and reverse it with a reason. Nothing is ever deleted.",
      ],
    },
    {
      title: "Members and setup codes",
      steps: [
        "Admin → Members → Add: name, phone, drive, Member or Executive, and the week their dues start. A setup code is made for them.",
        "Admin → Members → Setup Codes: codes for everyone who hasn't signed in, each with a WhatsApp button.",
        "Only the Director can give an officer a setup code.",
        "Someone started late? Open them and set “Dues start” to the week they started coming.",
      ],
    },
    {
      title: "Attendance and drive heads",
      steps: [
        "Take attendance: Attendance → the clipboard at the top. Tap each name: Present, Late, Excused, Absent. Then Save.",
        "No signal at the venue? Save on Phone. It's sent when you're back online.",
        "Drive heads mark on the day. Officers can correct until Sunday of that week; the Director any time.",
        "Admin → Attendance: excuse requests, who's missing a lot, everyone's rate, and adding or cancelling rehearsals. A cancelled rehearsal posts a notice on News.",
        "The Director chooses drive heads in Admin → Attendance → Drive Heads.",
      ],
    },
    {
      title: "Posting on News",
      steps: [
        "News → + . Choose who you post as, who sees it (everyone or one drive), tags, an optional event time and up to 4 pictures.",
        "Urgent posts show in red and notify everyone. Use them sparingly.",
        "Your post's ⋯ menu: Edit, Turn Comments Off, Delete. Officers can pin up to 3 posts and remove comments; the Director can remove any post.",
        "Officers can tap the eye on a post to see who has seen it.",
      ],
    },
    {
      title: "Money in and out",
      steps: [
        "Expenses: transport, costumes and so on. Other Income: donations, offerings, ticket sales.",
        "Cash Handovers: when cash moves between officers, the receiver confirms after counting it.",
        "Today and Reports show the totals. Reports export to Excel (CSV) or print.",
      ],
    },
    {
      title: "Weeks and the semester",
      steps: [
        "Admin → Semester: tap a week to name it (e.g. Interim Assessment) and choose whether dues are paid.",
        "Officers can start a semester and change its name and dates. The weeks follow the dates.",
        "Rates and closing a semester are for the Director.",
      ],
    },
  ],
  director: [
    {
      title: "Officers",
      steps: [
        "Open a member → Role to make them an officer (Financial Secretary, Treasurer or another admin).",
        "If they're new, give them a setup code; they choose a 6-digit PIN when they activate.",
        "If they already use the app, they're asked to set a 6-digit officer PIN next time they open it.",
        "To remove officer powers, set their role back to Member.",
      ],
    },
    {
      title: "Rates and closing",
      steps: [
        "Admin → Semester: set the weekly rate for executives and members.",
        "At the end of the semester, close it. Its records can still be read but not changed.",
      ],
    },
    {
      title: "The Audit Log",
      steps: [
        "Every change is recorded: who, what and when. Entries can never be edited or removed.",
      ],
    },
  ],
};

export function GuidePage() {
  const { data: me } = useCurrentMember();
  const start: GuideRole = isDirector(me) ? "director" : isAdmin(me) || me?.officerPending ? "officer" : "member";
  const [role, setRole] = useState<GuideRole>(start);
  return (
    <>
      <PageHeader title="User Guide" back={back} />
      <div className="mb-6">
        <Segmented<GuideRole>
          label="Guide for"
          value={role}
          onChange={setRole}
          options={[
            { value: "member", label: "Members" },
            { value: "officer", label: "Officers" },
            { value: "director", label: "Director" },
          ]}
        />
      </div>
      {GUIDES[role].map((topic) => (
        <ListSection key={topic.title} header={topic.title} padded>
          <ol className="space-y-2.5">
            {topic.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-body">
                <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-tint/20 text-footnote font-bold text-tint-text">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </ListSection>
      ))}
    </>
  );
}

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Where do I get my setup code?",
    a: "From an officer, usually the Financial Secretary. They send it on WhatsApp with your Member ID. It works once and lasts 7 days.",
  },
  {
    q: "I forgot my PIN.",
    a: "Ask the Financial Secretary for a new setup code, then tap “First time? Activate your account” and choose a new PIN.",
  },
  {
    q: "My account says it's locked.",
    a: "Too many wrong PINs. Wait 15 minutes, or ask an officer to unlock it.",
  },
  {
    q: "I paid but it doesn't show.",
    a: "A payment appears once an officer records it, with a receipt number. If it's been a while, show the Financial Secretary your MoMo transaction ID.",
  },
  {
    q: "Why does a week say “No dues”?",
    a: "Officers can switch off dues for a week, like Interim Assessment or a break. Nobody pays for those weeks.",
  },
  {
    q: "What does Paid ahead mean?",
    a: "You've paid for weeks that haven't come yet. Home shows the week your payments cover up to.",
  },
  {
    q: "Does it work without internet?",
    a: "You can see your last-loaded dues and receipts. Changes need a connection, and the app updates itself when you're back online.",
  },
  {
    q: "How do I install it on my phone?",
    a: "Settings → Install the App shows the exact steps for your phone. On iPhone it's Safari → Share → Add to Home Screen.",
  },
  {
    q: "Who can see my details?",
    a: "Only you and the officers. Other members can't see your dues, phone number or details.",
  },
  {
    q: "Why was I marked absent?",
    a: "If attendance was taken at a rehearsal and you weren't ticked, it counts as absent. If that's wrong, ask your drive head or an officer to correct it that week.",
  },
  {
    q: "How do I get notifications?",
    a: "Settings → Notifications → turn on Phone Notifications. On iPhone, add the app to your Home Screen first and open it from there.",
  },
  {
    q: "Who can see my comments and likes?",
    a: "Everyone who can see the post. Only officers can see who has viewed a post.",
  },
];

export function FaqPage() {
  return (
    <>
      <PageHeader title="FAQ" back={back} />
      <ul className="mb-8 overflow-hidden rounded-[0.75rem] bg-cell">
        {FAQ.map(({ q, a }) => (
          <li key={q} className="border-b-[0.5px] border-separator last:border-b-0">
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-3 text-body font-medium [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{q}</span>
                <ChevronDown
                  aria-hidden
                  className="size-[1.1rem] shrink-0 text-label-3 transition-transform group-open:rotate-180"
                  strokeWidth={2.6}
                />
              </summary>
              <p className="px-4 pb-4 text-callout text-label-2">{a}</p>
            </details>
          </li>
        ))}
      </ul>
      <p className="mb-8 text-center text-footnote text-label-2">
        Still stuck? Speak to the Financial Secretary at rehearsal.
      </p>
    </>
  );
}

const POLICY: { title: string; body: string[] }[] = [
  {
    title: "What we keep",
    body: [
      "Your name, Member ID, phone number, drive, category (member or executive) and, if you gave them, your birthday, level, course, hall and interests.",
      "Your dues payments and receipts, and the money records the officers keep for the ministry.",
    ],
  },
  {
    title: "Who can see it",
    body: [
      "You can see your own details, dues and receipts.",
      "The officers (Director, Financial Secretary, Treasurer) can see everyone's, to run the ministry's finances.",
      "Other members cannot see your details, dues or attendance. Drive heads see names and drives on the roll call, nothing else.",
      "On News, your name shows with your comments and likes. Your picture shows only if you're an officer or a drive head.",
    ],
  },
  {
    title: "Your PIN",
    body: [
      "Your PIN is never stored as you typed it. Only a scrambled version is kept, so nobody, including the officers, can read it.",
      "After too many wrong tries the account locks, to stop guessing.",
    ],
  },
  {
    title: "Changes and records",
    body: [
      "Money records are never edited or deleted. Mistakes are fixed by reversing them, with a reason.",
      "Every change is written to an audit log: who made it and when.",
    ],
  },
  {
    title: "Where it's kept",
    body: [
      "On secure servers run by Supabase. Your looks, text size and font are saved on your own phone only.",
      "Your data is used only for HIS Theatre Ministry and is never sold or shared.",
    ],
  },
  {
    title: "Questions or corrections",
    body: ["Ask the Financial Secretary or the Director to correct or remove your details."],
  },
];

export function PrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy Policy" back={back} />
      {POLICY.map((part) => (
        <ListSection key={part.title} header={part.title} padded>
          <div className="space-y-2 text-body">
            {part.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </ListSection>
      ))}
      <p className="mb-8 text-center text-footnote text-label-3">Hearts In Service Theatre Ministry</p>
    </>
  );
}
