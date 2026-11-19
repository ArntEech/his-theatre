# His Theatre

The official app of HIS (Hearts In Service) Theatre Ministry. Version 1 covers dues and ministry finance: member dues, payments and receipts, expenses, other income, cash handovers, reports, and Director tools. It installs on Android and iPhone from the browser.

## Run it on your computer

You need Node.js 22 or later, or Bun.

```sh
bun install      # or: npm install
bun run dev      # or: npm run dev  → http://localhost:8080
bun run test     # or: npm test
```

The first install creates a fresh lockfile. Commit it.

### Trying it out (mock data)

Data is fake for now and resets when you reload. On the sign-in screen, development builds show test logins. Use the "Preview as" switch at the top right to view the app as a member, the Financial Secretary, the Treasurer or the Director.

## Deploy to Vercel

1. Push this folder to a GitHub repository owned by the His Theatre account.
2. In Vercel, choose Add New → Project, import the repository and keep the default settings.
3. Every push to `main` goes live. Other branches get preview links.

## How the code is organised

| Folder | What's in it |
| --- | --- |
| `src/data/` | `types.ts` (all data shapes), `api.ts` (the ONLY way screens touch data; mock today), `queries.ts` |
| `src/lib/` | Dues calculation (`dues.ts`, with tests), money format, dates, CSV export, WhatsApp links |
| `src/modules/` | Screens, grouped by module: `auth`, `dues` (member screens), `admin` (officers and Director) |
| `src/routes/` | One file per page |
| `public/` | Icons, logo, app manifest, offline service worker |

## Next step: Supabase

Replace the mock functions in `src/data/api.ts` with Supabase calls, keeping every function name and shape the same. The database schema, access rules and PIN sign-in design are in the project documentation (Database Schema and TRD tabs).
