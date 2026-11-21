# Connecting His Theatre to its real database (Supabase)

Do these in order. Nothing here needs the terminal except shipping the code.
Supabase project: `https://qjpsbsgwxqyqwdoowywh.supabase.co`

## 1. Create the database (5 minutes)

1. Supabase → **SQL Editor** → **New query**.
2. Open `supabase/migrations/0001_his_theatre.sql`, copy all of it, paste, click **Run**. It should say "Success. No rows returned".
3. **New query** → paste all of `supabase/migrations/0002_member_profiles.sql` → **Run** (adds birthday, level, course, hall and the other registration details).
4. **New query** again → paste all of `supabase/setup/02_first_semester.sql` → **Run**. It should show `weeks 9, rates 2`.

Run each file **once**. If a run fails halfway, tell Claude before running anything again.

## 2. Sign-in settings (2 minutes)

1. **Authentication → Sign In / Providers** (or **Settings**): turn **off** "Allow new users to sign up". Only the app creates accounts.
2. **Authentication → Multi-Factor** (or **MFA**): make sure **TOTP (Authenticator app)** is **enabled**.

## 3. The PIN sign-in function (5 minutes)

1. **Edge Functions → Deploy a new function → Via Editor**.
2. Name it exactly: `pin-auth`
3. Delete the sample code, paste all of `supabase/functions/pin-auth/index.ts`, click **Deploy**.
4. Open the function's **Details / Settings** and turn **off** "Verify JWT" (also called "Enforce JWT verification"), then save.
   Members aren't signed in when they call it; the function and database do their own checks.
5. If the function's **Logs** later say "no service key": Settings → API Keys → copy the **secret** key →
   Edge Functions → **Secrets** → add `SERVICE_KEY` with that value. (Never paste it anywhere else.)

## 4. Members and payments from HIS Finance

1. In the HIS Finance Google Sheet: open the **Members** tab → File → Download → **Comma-separated values (.csv)**.
   Do the same for **Payments** (and Expenses, Other Income, Handovers if they have real rows).
2. Send the CSV files to Claude. Claude sends back `03_import.sql`; run it in the SQL Editor like step 1.

## 5. Officer accounts

For each officer (Director, Financial Secretary, Treasurer):

1. **Authentication → Users → Add user → Create new user**: their email, a strong password, tick **Auto Confirm User**.
2. Tell Claude each officer's email and Member ID (e.g. HIS-001). Claude sends a short SQL snippet that links each
   account to the member and gives them their role. Run it in the SQL Editor.
3. The first time each officer signs in (Officer tab), the app shows a QR code. They scan it with
   **Google Authenticator** (or Microsoft Authenticator) and enter the 6-digit code. After that, every sign-in asks for a code.

## 6. Switch the app on (2 minutes) — do this LAST

Vercel → the his-theatre project → **Settings → Environment Variables** → add both (all environments):

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://qjpsbsgwxqyqwdoowywh.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_…` key |

Then **Deployments** → the latest one → **⋯ → Redeploy**. The test logins and "Preview as" disappear: the app is live.

To go back to test data at any time, delete those two variables and redeploy.

## Members' first sign-in

1. An officer opens the member (Admin → Members → the member) → **Issue setup code** → **Send on WhatsApp**.
2. The member opens the app → **First time** → Member ID + the 6-digit code → chooses a 4-digit PIN.
3. Forgotten PIN or locked out: the officer issues a new setup code (or taps **Unlock**).

## Never share

The database password, and the **secret / service_role** key. The two values in step 6 are public by design.
