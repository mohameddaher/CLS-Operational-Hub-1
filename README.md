# CLS Operations Hub

Static web app (no build step). Data is stored in Supabase, hosting is on Vercel, code lives on GitHub.

Files: `index.html` (the app), `config.js` (your Supabase keys), `supabase-adapter.js` (connects the app to Supabase and shows the sign-in screen), `supabase-setup.sql` (database setup), `vercel.json`.

## 1. Supabase (do this first)

1. Open your project, then **SQL Editor → New query**. Paste all of `supabase-setup.sql` and click **Run**.
2. **Authentication → Users → Add user → Create new user.** Enter an email and password for each team member and tick **Auto Confirm User**.
3. **Authentication → Sign In / Providers → Email** (or **Settings**): turn **off** "Allow new users to sign up". Only the users you created can then get in.
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key (a `sb_publishable_...` key also works). Do not use the `service_role` key.
5. Open `config.js` and paste the URL and key in place of the two placeholders.

## 2. GitHub

Upload method (no Git needed): open your repository, click **Add file → Upload files**, drag in everything from this folder (including `.gitignore`), then **Commit changes**.

Git method:

```
cd cls-operations-hub
git init
git add .
git commit -m "CLS Operations Hub"
git branch -M main
git remote add origin https://github.com/YOUR-USER/YOUR-REPO.git
git push -u origin main
```

## 3. Vercel

1. vercel.com → **Add New → Project** → import your GitHub repository.
2. **Framework Preset: Other.** Leave Build Command and Output Directory empty. Click **Deploy**.
3. Open the Vercel link and sign in with one of the users from step 1.2.

Every later `git push` (or file upload on GitHub) redeploys automatically.

## Notes

- The anon key in `config.js` is meant to be public. Security comes from Row Level Security in the SQL file: only signed-in users can read or write.
- All signed-in users can edit all records. If you need view-only users, ask for role-based policies.
- If `config.js` is left unfilled, the app still opens and saves on that device only.

- Generator load: to load the recorded week (2 to 8 Oct 2026), run `supabase-import-gen-load.sql` in the Supabase SQL Editor. Running it twice does not create duplicates.

## Email reports (weekly and monthly)

`api/report.js` emails a summary (link throughput, generator load, PFE, UPS, alarms, incidents, activities, tasks, gate clearances) to your address. Vercel runs it by itself: **every Monday 07:00** (Mogadishu) for the last 7 days, and **on the 1st of each month 07:00** for the previous month. Times are set in `vercel.json` under `crons` (they are in UTC).

Set up once:

1. **Resend** (resend.com, free): sign up with the email that should receive the report, then **API Keys, Create API Key**. Copy it.
2. **Supabase**: Project Settings, API, copy the **service_role** key. It stays only in Vercel (never in `config.js` or GitHub).
3. **Vercel**: Project, Settings, Environment Variables, add (Production):
   - `SUPABASE_URL`: your Project URL
   - `SUPABASE_SERVICE_KEY`: the service_role key
   - `RESEND_API_KEY`: the Resend key
   - `REPORT_TO`: the email address(es), comma separated
   - `CRON_SECRET`: any long random text you make up
   - optional `REPORT_FROM` (after you verify your domain in Resend) and `APP_URL`
4. **Redeploy** (Deployments, latest, Redeploy).
5. **Test**: open `https://YOUR-SITE/api/report?type=weekly&secret=YOUR_CRON_SECRET&preview=1` to see the report, and without `&preview=1` to email it now.

Until you verify a domain in Resend, mail can only be sent to the email you signed up to Resend with.
