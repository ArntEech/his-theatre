/**
 * The app runs on the real Supabase database when both public settings are present
 * (VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY). Without them it runs on demo data
 * kept in this browser, which is handy for trying screens without touching real money.
 */
export const usesLiveData = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

/**
 * True only on demo data. Test accounts and the "Preview as" switch show only then,
 * so they can never appear on the real app.
 */
export const isDemo = !usesLiveData;
