/**
 * Types for Attendance, drive heads, News and notifications.
 * (Money types live in types.ts.)
 */
import type { IsoDate, IsoDateTime } from "./types";

/** "excused" is shown as "Absent with excuse": it doesn't count against them. */
export type AttendanceStatus = "present" | "excused" | "absent";

export interface Rehearsal {
  id: string;
  semesterId: string;
  heldOn: IsoDate;
  /** "regular": the Tuesday and Thursday rehearsals; "extra": added by an officer or drive head. */
  kind: "regular" | "extra";
  /** null: for everyone. Otherwise only that drive's members. */
  drive: string | null;
  title: string;
  /** "16:00" or null. */
  startsAt: string | null;
  isCancelled: boolean;
  cancelReason: string | null;
  /** Someone has taken attendance for it. */
  rollTaken: boolean;
}

export interface ExcuseRequest {
  reason: string;
  status: "pending" | "approved" | "declined";
}

/** One rehearsal as a member sees it. */
export interface RehearsalDay extends Rehearsal {
  /** Their mark. Past rehearsals with the roll taken but no mark count as absent. */
  status: AttendanceStatus | null;
  /** "upcoming", "today", "past" (relative to today). */
  when: "upcoming" | "today" | "past";
  /** False when the rehearsal isn't theirs: another drive's, before they joined, after they left. */
  forMe: boolean;
  excuse: ExcuseRequest | null;
  markedAt: IsoDateTime | null;
}

export interface AttendanceSummary {
  /** Rehearsals they were present at. */
  attended: number;
  present: number;
  excused: number;
  absent: number;
  /** Rehearsals that count towards the rate: past, taken, not excused. */
  counted: number;
  /** 0–1, or null when nothing counts yet. */
  rate: number | null;
  /** Rehearsals attended in a row, most recent first (excused ones don't break it). */
  streak: number;
  best: number;
}

export interface MyAttendance {
  semesterId: string;
  days: RehearsalDay[];
  summary: AttendanceSummary;
  next: RehearsalDay | null;
}

/** How long after a rehearsal it can still be marked. */
export interface AttendanceRules {
  headDays: number;
  officerDays: number;
  /** Rehearsals before this date (the app's launch) stay open until catchUpUntil. */
  catchUpBefore: IsoDate | null;
  catchUpUntil: IsoDate | null;
}

export const DEFAULT_ATTENDANCE_RULES: AttendanceRules = {
  headDays: 3,
  officerDays: 7,
  catchUpBefore: "2026-11-26",
  catchUpUntil: "2026-12-06",
};

export interface AttendanceAccess {
  /** Officer (6-digit PIN) or drive head. */
  canTake: boolean;
  isOfficer: boolean;
  isDirector: boolean;
  rules: AttendanceRules;
  ledDrives: string[];
  /** The drives this person belongs to. */
  myDrives: string[];
}

export interface RollCallEntry {
  memberId: string;
  memberCode: string;
  fullName: string;
  drives: string[];
  status: AttendanceStatus | null;
  markedByName: string | null;
  markedAt: IsoDateTime | null;
  excuse: ExcuseRequest | null;
}

export interface AttendanceMarkInput {
  memberId: string;
  status: AttendanceStatus | null;
}

export interface AttendanceTotals {
  present: number;
  excused: number;
  absent: number;
  changed: number;
}

export interface NewRehearsalInput {
  heldOn: IsoDate;
  drive: string | null;
  title: string;
  startsAt: string | null;
}

export interface DriveHead {
  memberId: string;
  fullName: string;
  drive: string;
}

/** A row in the officers' attendance overview. */
export interface AttendanceOverviewRow {
  memberId: string;
  memberCode: string;
  fullName: string;
  drive: string;
  summary: AttendanceSummary;
  /** Absences in a row up to the latest rehearsal. */
  missedInARow: number;
}

export interface PendingExcuse {
  rehearsalId: string;
  heldOn: IsoDate;
  memberId: string;
  fullName: string;
  reason: string;
}

/* ------------------------------------------------------------------ */
/* News                                                                 */
/* ------------------------------------------------------------------ */

export type PostKind = "post" | "birthday" | "notice";

export interface Post {
  id: string;
  authorId: string | null;
  /** "His Theatre" for automatic posts. */
  authorName: string;
  /** e.g. "Financial Secretary", "Head, Tribe of Judah". */
  authorLabel: string;
  authorPhoto: string | null;
  kind: PostKind;
  body: string;
  tags: string[];
  drive: string | null;
  urgent: boolean;
  eventAt: IsoDateTime | null;
  commentsOff: boolean;
  pinned: boolean;
  /** Today's birthday post sits on top all day. */
  isTodaysBirthday: boolean;
  birthdayNames: string[];
  imageCount: number;
  createdAt: IsoDateTime;
  editedAt: IsoDateTime | null;
  likes: number;
  comments: number;
  views: number;
  likedByMe: boolean;
  seenByMe: boolean;
}

export interface PostComment {
  id: string;
  parentId: string | null;
  memberId: string;
  fullName: string;
  label: string;
  photo: string | null;
  body: string;
  createdAt: IsoDateTime;
  editedAt: IsoDateTime | null;
}

export interface PostInput {
  body: string;
  tags: string[];
  drive: string | null;
  urgent: boolean;
  eventAt: IsoDateTime | null;
  authorLabel: string;
  /** Data URLs, at most 4. */
  images: string[];
}

export interface PostUpdate {
  body?: string;
  tags?: string[];
  eventAt?: IsoDateTime | null;
  commentsOff?: boolean;
}

export interface PersonRef {
  memberId: string;
  fullName: string;
  at?: IsoDateTime;
}

export interface ReportedComment {
  commentId: string;
  postId: string;
  authorName: string;
  body: string;
  reports: number;
  reasons: string[];
}

/** What a person may do on News. */
export interface NewsAccess {
  canPost: boolean;
  isOfficer: boolean;
  isDirector: boolean;
  labels: string[];
  /** Drives they may post to. Officers: every drive (and everyone). */
  drives: string[];
}

/* ------------------------------------------------------------------ */
/* Settings and notifications                                           */
/* ------------------------------------------------------------------ */

export type NotifyKind = "news" | "comments" | "birthday" | "dues" | "handovers" | "attendance";

export interface MySettings {
  birthdayPost: boolean;
  notify: Record<NotifyKind, boolean>;
}

export const NOTIFY_DEFAULTS: Record<NotifyKind, boolean> = {
  news: true,
  comments: true,
  birthday: true,
  dues: true,
  attendance: true,
  handovers: true,
};

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}
