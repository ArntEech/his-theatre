// Which data does the app use?
//
// If Vercel (or a local .env file) has VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY,
// the app uses the real database (api.live.ts). Without them it uses test data (api.mock.ts),
// which resets on reload and shows test sign-ins.
//
// Every screen imports from this file only, so neither version needs any screen changes.

import * as live from "./api.live";
import * as mock from "./api.mock";

const USE_LIVE = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

// Both versions must offer exactly the same functions with the same shapes (checked by TypeScript here).
const impl: Omit<typeof mock, "IS_MOCK" | "DEV_SIGN_IN_HINTS" | "ApiError"> = USE_LIVE ? live : mock;

export { ApiError } from "./errors";
/** True while the app uses test data. Test sign-in hints and "Preview as" only show while it is. */
export const IS_MOCK = !USE_LIVE;
export const DEV_SIGN_IN_HINTS = mock.DEV_SIGN_IN_HINTS;

export const signInMember = impl.signInMember;
export const activateMember = impl.activateMember;
export const signInOfficer = impl.signInOfficer;
export const verifyOfficerCode = impl.verifyOfficerCode;
export const signOut = impl.signOut;
export const getCurrentMember = impl.getCurrentMember;
export const changePin = impl.changePin;
export const devPreviewAs = impl.devPreviewAs;
export const getReceipt = impl.getReceipt;
export const getMyDues = impl.getMyDues;
export const getMyMembership = impl.getMyMembership;
export const getMyPayments = impl.getMyPayments;
export const listSemesters = impl.listSemesters;
export const getCurrentSemester = impl.getCurrentSemester;
export const getSemesterWeeks = impl.getSemesterWeeks;
export const getRates = impl.getRates;
export const listMembers = impl.listMembers;
export const listDrives = impl.listDrives;
export const getMember = impl.getMember;
export const addMember = impl.addMember;
export const updateMember = impl.updateMember;
export const deactivateMember = impl.deactivateMember;
export const issueSetupCode = impl.issueSetupCode;
export const unlockMember = impl.unlockMember;
export const setRole = impl.setRole;
export const recordPayment = impl.recordPayment;
export const reversePayment = impl.reversePayment;
export const addAdjustment = impl.addAdjustment;
export const listExpenses = impl.listExpenses;
export const recordExpense = impl.recordExpense;
export const reverseExpense = impl.reverseExpense;
export const listIncome = impl.listIncome;
export const recordIncome = impl.recordIncome;
export const reverseIncome = impl.reverseIncome;
export const listHandovers = impl.listHandovers;
export const recordHandover = impl.recordHandover;
export const confirmHandover = impl.confirmHandover;
export const getCashPosition = impl.getCashPosition;
export const getToday = impl.getToday;
export const getDashboard = impl.getDashboard;
export const getReport = impl.getReport;
export const saveSemester = impl.saveSemester;
export const addWeeks = impl.addWeeks;
export const setStartWeek = impl.setStartWeek;
export const setWeekCounts = impl.setWeekCounts;
export const setRates = impl.setRates;
export const closeSemester = impl.closeSemester;
export const listAudit = impl.listAudit;
export const listOfficers = impl.listOfficers;
