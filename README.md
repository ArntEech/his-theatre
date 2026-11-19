# His Theatre

The official app of HIS (Hearts In Service) Theatre Ministry. Version 1 covers dues and ministry finance: member dues, payments and receipts, expenses, other income, cash handovers from the Financial Secretary to the Treasurer, reports, and Director tools. It installs on Android and iPhone from the browser.

## Two modes

| Mode | When | What you see |
| --- | --- | --- |
| **Demo data** | The two Supabase settings are missing | Fake members and money kept in this browser. Test logins show on the sign-in screens, and "Preview as" lets you view the app as anyone. |
| **Real data** | `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set | The real database. No test logins, no "Preview as". |

Both settings are public by design. Never put the database password or the secret / service_role key in the app, the repository or Vercel's front-end settings.

## Run it on your computer

You need Node.js 22 or later.

```sh
npm install
npm run dev      # → http://localhost:8080
npm test
```

Copy `.env.example` to `.env.local` to use the real database locally; delete `.env.local` to go back to demo data.

## Deploy to Vercel

Every push to `main` goes live at his-theatre.vercel.app; other branches get preview links. `vercel.json` holds the build settings, page routing and security headers.

To switch the live app to real data: in Vercel → Project → Settings → Environment Variables, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then redeploy. Do this only after the steps in `supabase/SETUP.md`.

## How the code is organised

| Folder | What's in it |
| --- | --- |
| `src/data/` | `types.ts` (all data shapes); `api.ts` (the only way screens touch data; picks live or demo); `api.live.ts` (Supabase); `api.mock.ts` (demo data); `derive.ts` (dues, cash and report numbers for live data); `queries.ts` |
| `src/lib/` | Dues rules (`dues.ts`), money, dates, Member ID clean-up, PIN rules, WhatsApp links, all with tests |
| `src/modules/` | Screens: `auth`, `dues` (member screens), `admin` (officers and Director) |
| `src/components/` | Shared building blocks: buttons, fields, lists, sheets |
| `supabase/` | The database (tables, rules, tests passed), first semester, the PIN sign-in function, and `SETUP.md` |
| `public/` | App icons |

## How sign-in works

- **Members**: Member ID + 4-digit PIN. The Financial Secretary gives a one-time 6-digit setup code (it can be sent on WhatsApp); the member uses it once to choose a PIN. Five wrong PINs lock the account for 15 minutes; ten lock it until an officer unlocks it.
- **Officers** (Director, Financial Secretary, Treasurer): email + password, then a 6-digit code from an authenticator app such as Google Authenticator. The first sign-in shows a code to scan. Without the authenticator step, an officer only gets the member view, and the database refuses officer actions.
