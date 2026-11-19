// Query definitions for TanStack Query. Every function here calls src/data/api.ts — never mock data.
import { queryOptions } from "@tanstack/react-query";

import * as api from "./api";
import type { AuditFilters, ISODate, MemberFilters } from "./types";

export const qk = {
  all: ["his"] as const,
};

export const currentMemberQuery = () =>
  queryOptions({ queryKey: [...qk.all, "me"], queryFn: api.getCurrentMember, staleTime: Infinity });

export const currentSemesterQuery = () =>
  queryOptions({ queryKey: [...qk.all, "semester", "current"], queryFn: api.getCurrentSemester });

export const semestersQuery = () =>
  queryOptions({ queryKey: [...qk.all, "semesters"], queryFn: api.listSemesters });

export const semesterWeeksQuery = (semesterId: string) =>
  queryOptions({ queryKey: [...qk.all, "weeks", semesterId], queryFn: () => api.getSemesterWeeks(semesterId) });

export const ratesQuery = (semesterId: string) =>
  queryOptions({ queryKey: [...qk.all, "rates", semesterId], queryFn: () => api.getRates(semesterId) });

export const myDuesQuery = (semesterId: string) =>
  queryOptions({ queryKey: [...qk.all, "my-dues", semesterId], queryFn: () => api.getMyDues(semesterId) });

export const myMembershipQuery = (semesterId: string) =>
  queryOptions({ queryKey: [...qk.all, "my-membership", semesterId], queryFn: () => api.getMyMembership(semesterId) });

export const myPaymentsQuery = (semesterId: string) =>
  queryOptions({ queryKey: [...qk.all, "my-payments", semesterId], queryFn: () => api.getMyPayments(semesterId) });

export const membersQuery = (filters: MemberFilters = {}) =>
  queryOptions({ queryKey: [...qk.all, "members", filters], queryFn: () => api.listMembers(filters) });

export const drivesQuery = () =>
  queryOptions({ queryKey: [...qk.all, "drives"], queryFn: api.listDrives });

export const memberQuery = (id: string) =>
  queryOptions({ queryKey: [...qk.all, "member", id], queryFn: () => api.getMember(id) });

export const officersQuery = () =>
  queryOptions({ queryKey: [...qk.all, "officers"], queryFn: api.listOfficers });

export const todayQuery = () =>
  queryOptions({ queryKey: [...qk.all, "today"], queryFn: api.getToday });

export const cashPositionQuery = () =>
  queryOptions({ queryKey: [...qk.all, "cash-position"], queryFn: api.getCashPosition });

export const dashboardQuery = (semesterId: string) =>
  queryOptions({ queryKey: [...qk.all, "dashboard", semesterId], queryFn: () => api.getDashboard(semesterId) });

export const reportQuery = (from: ISODate, to: ISODate) =>
  queryOptions({ queryKey: [...qk.all, "report", from, to], queryFn: () => api.getReport(from, to) });

export const expensesQuery = () =>
  queryOptions({ queryKey: [...qk.all, "expenses"], queryFn: api.listExpenses });

export const incomeQuery = () =>
  queryOptions({ queryKey: [...qk.all, "income"], queryFn: api.listIncome });

export const handoversQuery = () =>
  queryOptions({ queryKey: [...qk.all, "handovers"], queryFn: api.listHandovers });

export const receiptQuery = (paymentId: string) =>
  queryOptions({ queryKey: [...qk.all, "receipt", paymentId], queryFn: () => api.getReceipt(paymentId) });

export const auditQuery =(filters: AuditFilters = {}) =>
  queryOptions({ queryKey: [...qk.all, "audit", filters], queryFn: () => api.listAudit(filters) });
