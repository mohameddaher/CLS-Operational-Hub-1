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
