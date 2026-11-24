import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { usesLiveData } from "@/lib/env";
import { ApiError } from "@/data/types";
import { FlashProvider } from "@/components/Flash";
import { LiveUpdates } from "@/components/LiveUpdates";
import { AppShell, BareShell } from "@/components/AppShell";
import { RedirectIfSignedIn, RequireAdmin, RequireAuth } from "@/components/guards";
import { SignInPage } from "@/modules/auth/SignInPage";
import { ActivatePage } from "@/modules/auth/ActivatePage";
import { ProfilePage } from "@/modules/auth/ProfilePage";
import { SettingsPage } from "@/modules/settings/SettingsPage";
import { PersonalizationPage } from "@/modules/settings/PersonalizationPage";
import { DevicesPage } from "@/modules/settings/DevicesPage";
import { DataPage } from "@/modules/settings/DataPage";
import { LogOutPage } from "@/modules/settings/LogOutPage";
import { OfficerPinPage } from "@/modules/settings/OfficerPinPage";
import { FaqPage, GuidePage, PrivacyPage } from "@/modules/settings/HelpPages";
import { HomePage } from "@/modules/dues/HomePage";
import { DuesPage } from "@/modules/dues/DuesPage";
import { AnnouncementsPage, AttendancePage } from "@/modules/soon/ComingSoonPage";
import { AdminHomePage } from "@/modules/admin/AdminHomePage";
import { TodayPage } from "@/modules/admin/TodayPage";
import { MembersPage } from "@/modules/admin/MembersPage";
import { AddMemberPage } from "@/modules/admin/AddMemberPage";
import { SetupCodesPage } from "@/modules/admin/SetupCodesPage";
import { MemberDetailPage } from "@/modules/admin/MemberDetailPage";
import { RecordPaymentPage } from "@/modules/admin/RecordPaymentPage";
import { ExpensesPage } from "@/modules/admin/ExpensesPage";
import { IncomePage } from "@/modules/admin/IncomePage";
import { HandoversPage } from "@/modules/admin/HandoversPage";
import { ReportsPage } from "@/modules/admin/ReportsPage";
import { SemesterPage } from "@/modules/admin/SemesterPage";
import { AuditPage } from "@/modules/admin/AuditPage";

const WEEK = 7 * 24 * 60 * 60 * 1000;

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    // An expired session anywhere sends the person back to sign in.
    onError: (error) => {
      if (error instanceof ApiError && error.code === "unauthenticated")
        queryClient.setQueryData(["me"], null);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Keep data long enough to be saved for offline viewing.
      gcTime: WEEK,
      refetchOnWindowFocus: true,
      // Permission and validation errors will not fix themselves on retry.
      retry: (count, error) => !(error instanceof ApiError) && count < 2,
    },
    mutations: {
      // Mutations fail fast offline (see useApiMutation) rather than waiting silently.
      networkMode: "always",
    },
  },
});

/**
 * Offline mode: the last data seen on this phone is saved and shown when there is no connection.
 * It is cleared for everyone else's records on sign-out (see useSessionMutation).
 */
const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "his-theatre.cache",
});

/** Works whether the app is served from the domain root or a sub-path. */
const basename =
  new URL(import.meta.env.BASE_URL, window.location.href).pathname.replace(/\/$/, "") || undefined;

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: WEEK, buster: usesLiveData ? "live-2" : "demo-4" }}
      // The saved copy shows instantly; then everything is fetched fresh, so a refresh always
      // brings the latest changes (a renamed week, a new payment). Offline, the saved copy stays.
      onSuccess={() => queryClient.invalidateQueries()}
    >
      <FlashProvider>
        <LiveUpdates />
        <BrowserRouter basename={basename}>
          <Routes>
            <Route
              element={
                <RedirectIfSignedIn>
                  <BareShell />
                </RedirectIfSignedIn>
              }
            >
              <Route path="signin" element={<SignInPage />} />
              <Route path="activate" element={<ActivatePage />} />
              {/* Officers now sign in on the main screen with their 6-digit PIN. */}
              <Route path="officer" element={<Navigate to="/signin" replace />} />
            </Route>

            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<HomePage />} />
              <Route path="dues" element={<DuesPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/personalization" element={<PersonalizationPage />} />
              <Route path="settings/devices" element={<DevicesPage />} />
              <Route path="settings/data" element={<DataPage />} />
              <Route path="settings/logout" element={<LogOutPage />} />
              <Route path="settings/officer-pin" element={<OfficerPinPage />} />
              <Route path="settings/guide" element={<GuidePage />} />
              <Route path="settings/faq" element={<FaqPage />} />
              <Route path="settings/privacy" element={<PrivacyPage />} />
              <Route path="admin">
                <Route
                  index
                  element={
                    <RequireAdmin>
                      <AdminHomePage />
                    </RequireAdmin>
                  }
                />
                {[
                  ["today", <TodayPage />],
                  ["members", <MembersPage />],
                  ["members/new", <AddMemberPage />],
                  ["members/setup-codes", <SetupCodesPage />],
                  ["members/:id", <MemberDetailPage />],
                  ["pay", <RecordPaymentPage />],
                  ["expenses", <ExpensesPage />],
                  ["income", <IncomePage />],
                  ["handovers", <HandoversPage />],
                  ["reports", <ReportsPage />],
                  ["semester", <SemesterPage />],
                  ["audit", <AuditPage />],
                ].map(([path, element]) => (
                  <Route
                    key={path as string}
                    path={path as string}
                    element={<RequireAdmin>{element}</RequireAdmin>}
                  />
                ))}
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </FlashProvider>
    </PersistQueryClientProvider>
  );
}
