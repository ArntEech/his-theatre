# His Theatre: notes for anyone (or any AI) working on this code

- Every screen gets and changes data ONLY through `src/data/api.ts`. It is a mock today and will be swapped for Supabase without changing any screen.
- Money is always an integer number of pesewas (GH₵1 = 100). Format it only with `formatCedi`.
- Money is never edited or deleted. Mistakes are fixed with a reversal or an adjustment that has a reason.
- The real security (who can see and change what) lives in the database rules described in the project documentation (TRD and Database Schema). Screen-level checks are for usability only.
- Never store a PIN, setup code or password in the browser, and never log one.
- Never put secret keys in this repository.
