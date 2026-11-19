// The one door every screen uses for data.
//
// With the Supabase settings present (VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY),
// this is the real database (api.live.ts). Without them it is demo data kept in this
// browser (api.mock.ts). Both have exactly the same functions and shapes; the line
// below fails to compile if they ever drift apart.

import * as live from "./api.live";
import * as mock from "./api.mock";
import { usesLiveData } from "@/lib/env";

const api: typeof mock = usesLiveData ? live : mock;

export const {
  signInMember,
  activateMember,
  signInOfficer,
  verifyOfficerCode,
  signOut,
  getCurrentMember,
  changePin,
  getMyDues,
  getMyPayments,
  listSemesters,
  getCurrentSemester,
  listMembers,
  getMember,
  addMember,
  updateMember,
  deactivateMember,
  recordPayment,
  reversePayment,
  addAdjustment,
  recordExpense,
  reverseExpense,
  recordIncome,
  reverseIncome,
  recordHandover,
  confirmHandover,
  getCashPosition,
  getToday,
  getDashboard,
  getReport,
  saveSemester,
  setWeekCounts,
  setRates,
  closeSemester,
  issueSetupCode,
  unlockMember,
  setRole,
  listAudit,
  devPreviewAs,
  devResetMockData,
} = api;
