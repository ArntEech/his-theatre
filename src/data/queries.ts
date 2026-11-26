/**
 * TanStack Query hooks over src/data/api.ts.
 * Screens use these hooks (or api.ts directly); they never touch mock data.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import {
  ApiError,
  type AuditFilters,
  type IsoDate,
  type Member,
  type MemberFilters,
} from "./types";
import { isOnline, OFFLINE_MESSAGE } from "@/lib/online";

export const keys = {
  me: ["me"] as const,
  currentSemester: ["semester", "current"] as const,
  semesters: ["semesters"] as const,
  myDues: (semesterId: string) => ["myDues", semesterId] as const,
  myPayments: (semesterId: string) => ["myPayments", semesterId] as const,
  members: (filters: MemberFilters) => ["members", filters] as const,
  member: (id: string) => ["member", id] as const,
  today: ["today"] as const,
  dashboard: (semesterId: string) => ["dashboard", semesterId] as const,
  report: (from: IsoDate, to: IsoDate) => ["report", from, to] as const,
  cash: ["cash"] as const,
  audit: (filters: AuditFilters) => ["audit", filters] as const,
};

export function useCurrentMember() {
  return useQuery({ queryKey: keys.me, queryFn: api.getCurrentMember, staleTime: Infinity });
}

/** Profile pictures you can see: your own, or everyone's if you're an officer. */
export function useMemberPhotos() {
  const { data: me } = useCurrentMember();
  return useQuery({
    queryKey: ["photos", me?.id ?? "", me?.role ?? ""],
    queryFn: api.getMemberPhotos,
    enabled: Boolean(me),
    staleTime: 5 * 60_000,
  });
}

export function useCurrentSemester() {
  return useQuery({ queryKey: keys.currentSemester, queryFn: api.getCurrentSemester });
}

export function useSemesters() {
  return useQuery({ queryKey: keys.semesters, queryFn: api.listSemesters });
}

export function useMyDues(semesterId: string | undefined) {
  return useQuery({
    queryKey: keys.myDues(semesterId ?? ""),
    queryFn: () => api.getMyDues(semesterId!),
    enabled: Boolean(semesterId),
  });
}

export function useMyPayments(semesterId: string | undefined) {
  return useQuery({
    queryKey: keys.myPayments(semesterId ?? ""),
    queryFn: () => api.getMyPayments(semesterId!),
    enabled: Boolean(semesterId),
  });
}

export function useMembers(filters: MemberFilters) {
  return useQuery({
    queryKey: keys.members(filters),
    queryFn: () => api.listMembers(filters),
    placeholderData: (prev) => prev,
  });
}

export function useMember(id: string | undefined) {
  return useQuery({
    queryKey: keys.member(id ?? ""),
    queryFn: () => api.getMember(id!),
    enabled: Boolean(id),
  });
}

export function useToday(enabled = true) {
  return useQuery({ queryKey: keys.today, queryFn: api.getToday, enabled });
}

export function useDashboard(semesterId: string | undefined) {
  return useQuery({
    queryKey: keys.dashboard(semesterId ?? ""),
    queryFn: () => api.getDashboard(semesterId!),
    enabled: Boolean(semesterId),
  });
}

export function useReport(from: IsoDate, to: IsoDate, enabled = true) {
  return useQuery({
    queryKey: keys.report(from, to),
    queryFn: () => api.getReport(from, to),
    enabled: enabled && Boolean(from && to) && from <= to,
    placeholderData: (prev) => prev,
  });
}

export function useCashPosition() {
  return useQuery({ queryKey: keys.cash, queryFn: api.getCashPosition });
}

export function useAudit(filters: AuditFilters) {
  return useQuery({
    queryKey: keys.audit(filters),
    queryFn: () => api.listAudit(filters),
    placeholderData: (prev) => prev,
  });
}

/**
 * Wraps an api mutation. Money and records touch many screens at once,
 * so every successful change refreshes all cached data except the signed-in member.
 */
export function useApiMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => guardOnline(() => fn(...args)),
    onSuccess: () => queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" }),
  });
}

/** For sign in / out and role switches, which change who is looking. */
export function useSessionMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => guardOnline(() => fn(...args)),
    onSuccess: async (data) => {
      // Never leave one person's records cached for the next person on this phone.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      const session = data as { member?: Member } | undefined;
      if (session && typeof session === "object" && session.member) {
        queryClient.setQueryData(keys.me, session.member);
      } else if (data === undefined) {
        queryClient.setQueryData(keys.me, null);
      }
    },
  });
}

/** Changes need the server. Offline, fail straight away with a clear message instead of hanging. */
function guardOnline<T>(run: () => Promise<T>): Promise<T> {
  if (!isOnline()) return Promise.reject(new ApiError(OFFLINE_MESSAGE, "offline"));
  return run();
}

/* ------------------------------------------------------------------ */
/* Attendance, News, settings                                           */
/* ------------------------------------------------------------------ */

export function useAttendanceAccess() {
  const { data: me } = useCurrentMember();
  return useQuery({
    queryKey: ["attendanceAccess", me?.id ?? "", me?.role ?? ""],
    queryFn: api.getAttendanceAccess,
    enabled: Boolean(me),
    staleTime: 60_000,
  });
}

export function useMyAttendance(semesterId: string | undefined) {
  return useQuery({
    queryKey: ["myAttendance", semesterId ?? ""],
    queryFn: () => api.getMyAttendance(semesterId!),
    enabled: Boolean(semesterId),
  });
}

export function useMemberAttendance(memberId: string | undefined, semesterId: string | undefined) {
  return useQuery({
    queryKey: ["memberAttendance", memberId ?? "", semesterId ?? ""],
    queryFn: () => api.getMemberAttendance(memberId!, semesterId!),
    enabled: Boolean(memberId && semesterId),
  });
}

export function useRehearsals(semesterId: string | undefined) {
  return useQuery({
    queryKey: ["rehearsals", semesterId ?? ""],
    queryFn: () => api.listRehearsals(semesterId!),
    enabled: Boolean(semesterId),
  });
}

export function useRollCall(rehearsalId: string | undefined) {
  return useQuery({
    queryKey: ["rollCall", rehearsalId ?? ""],
    queryFn: () => api.getRollCall(rehearsalId!),
    enabled: Boolean(rehearsalId),
  });
}

export function useAttendanceOverview(semesterId: string | undefined) {
  return useQuery({
    queryKey: ["attendanceOverview", semesterId ?? ""],
    queryFn: () => api.getAttendanceOverview(semesterId!),
    enabled: Boolean(semesterId),
  });
}

export function useDriveHeads() {
  return useQuery({ queryKey: ["driveHeads"], queryFn: api.listDriveHeads, staleTime: 5 * 60_000 });
}

export function useDrives(enabled = true) {
  return useQuery({ queryKey: ["drives"], queryFn: api.listDrives, enabled, staleTime: 5 * 60_000 });
}

export function useNewsAccess() {
  const { data: me } = useCurrentMember();
  return useQuery({
    queryKey: ["newsAccess", me?.id ?? "", me?.role ?? ""],
    queryFn: api.getNewsAccess,
    enabled: Boolean(me),
    staleTime: 60_000,
  });
}

export function useNewsFeed(tag: string | null) {
  return useQuery({
    queryKey: ["news", tag ?? ""],
    queryFn: () => api.getNewsFeed({ tag }),
    placeholderData: (prev) => prev,
  });
}

export function usePostImages(postId: string, count: number) {
  return useQuery({
    queryKey: ["postImages", postId, count],
    queryFn: () => api.getPostImages(postId),
    enabled: count > 0,
    staleTime: Infinity,
  });
}

export function useComments(postId: string | null) {
  return useQuery({
    queryKey: ["comments", postId ?? ""],
    queryFn: () => api.getComments(postId!),
    enabled: Boolean(postId),
  });
}

export function useUnreadNews() {
  const { data: me } = useCurrentMember();
  return useQuery({
    queryKey: ["newsUnread", me?.id ?? ""],
    queryFn: api.getUnreadNews,
    enabled: Boolean(me),
    refetchInterval: 5 * 60_000,
  });
}

export function useMySettings() {
  const { data: me } = useCurrentMember();
  return useQuery({ queryKey: ["mySettings", me?.id ?? ""], queryFn: api.getMySettings, enabled: Boolean(me) });
}
