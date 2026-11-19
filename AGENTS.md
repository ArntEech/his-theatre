# His Theatre: notes for anyone (or any AI) working on this code

- Every screen gets and changes data ONLY through `src/data/api.ts`. It chooses `api.live.ts` (Supabase) or `api.mock.ts` (demo data). Both must keep exactly the same functions and shapes; `api.ts` won't compile if they drift.
- If you change a dues, cash or report rule, change it in both `derive.ts` (live) and `api.mock.ts`, and keep `derive.test.ts` passing; it checks they agree.
- Money is always an integer number of pesewas (GH₵1 = 100). Format it only with `formatCedi`.
- Money is never edited or deleted. Mistakes are fixed with a reversal or an adjustment that has a reason.
- The real security (who can see and change what) lives in the database: `supabase/migrations/0001_his_theatre.sql`. Screen checks are for usability only. Never weaken a database rule to make a screen work.
- Never store a PIN, setup code or password in the browser, and never log one.
- Never put secret keys in this repository. Only the Supabase URL and publishable key belong in the app.
- Test logins and "Preview as" must only appear on demo data (`isDemo` in `src/lib/env.ts`).
