/**
 * Tab bar glyphs drawn in the style of SF Symbols: an outline for unselected tabs and a
 * filled variant for the selected tab.
 */
type IconProps = { filled?: boolean; className?: string };

const common = {
  viewBox: "0 0 24 24",
  "aria-hidden": true,
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function HomeGlyph({ filled, className }: IconProps) {
  const d =
    "M3.5 10.2 12 3.2l8.5 7V19a1.8 1.8 0 0 1-1.8 1.8H15v-5.6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5.6H5.3A1.8 1.8 0 0 1 3.5 19z";
  return (
    <svg
      {...common}
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
    >
      <path d={d} />
    </svg>
  );
}

export function DuesGlyph({ filled, className }: IconProps) {
  return filled ? (
    <svg {...common} className={className} fill="currentColor" stroke="currentColor">
      <path d="M3.5 8a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v1.2h-17z" />
      <path d="M3.5 11.2h17V18a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3z" />
      <path d="M8 3v3M16 3v3" fill="none" />
    </svg>
  ) : (
    <svg {...common} className={className} fill="none" stroke="currentColor">
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M3.5 10h17M8 3v3M16 3v3" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" strokeWidth={2.4} />
    </svg>
  );
}

export function AdminGlyph({ filled, className }: IconProps) {
  const d =
    "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z";
  return (
    <svg
      {...common}
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
    >
      <path d={d} />
      <path
        d="M15 6.5v11"
        strokeDasharray="1.6 2.2"
        stroke={filled ? "var(--grouped)" : "currentColor"}
      />
    </svg>
  );
}

export function ProfileGlyph({ filled, className }: IconProps) {
  return (
    <svg
      {...common}
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
    >
      <circle cx="12" cy="8" r="4" />
      <path d={filled ? "M4 20.5a8 8 0 0 1 16 0z" : "M4 20.5a8 8 0 0 1 16 0"} />
    </svg>
  );
}

/** A person with a tick: who was there. */
export function AttendanceGlyph({ filled, className }: IconProps) {
  return (
    <svg
      {...common}
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
    >
      <circle cx="9.5" cy="7.5" r="3.6" />
      <path d="M2.8 20.2a6.7 6.7 0 0 1 13.4 0z" />
      <path d="m15.8 11.6 2.2 2.2 4.2-4.6" fill="none" />
    </svg>
  );
}

/** A megaphone: notices for everyone. */
export function AnnouncementsGlyph({ filled, className }: IconProps) {
  return (
    <svg
      {...common}
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
    >
      <path d="M3.5 10a2 2 0 0 1 2-2h3l8.5-4.3v16.6L8.5 16h-3a2 2 0 0 1-2-2z" />
      <path d="M8.5 16.2 10 20.5" fill="none" />
      <path d="M20 9.5a3.5 3.5 0 0 1 0 5" fill="none" />
    </svg>
  );
}

export function SettingsGlyph({ filled, className }: IconProps) {
  const d =
    "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z";
  return (
    <svg
      {...common}
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
    >
      <path d={d} />
      <circle cx="12" cy="12" r="3" fill={filled ? "var(--grouped)" : "none"} />
    </svg>
  );
}
