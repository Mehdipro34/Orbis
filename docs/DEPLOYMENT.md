# ORBIS deployment and smoke-test checklist

## Current production

- App: https://orbis-mehdipro34.vercel.app
- Hosting: Vercel, connected to the GitHub `main` branch.
- Static app: `public/`.
- RSS endpoint: `api/news.js`.
- Social API and media uploads: Supabase Edge Function `orbis-api`.
- Supabase project ref: `wdwvcvpgovvkoodozbxf`.

A GitHub commit to `main` triggers a Vercel production deployment. Confirm the deployment state is `READY` before sharing the release.

## 1. Supabase Auth configuration

Open the ORBIS Supabase project → Authentication → Sign In / Providers.

1. Ensure the **Email** provider is enabled.
2. Keep email confirmation enabled.
3. In Authentication → URL Configuration, set the Site URL to `https://orbis-mehdipro34.vercel.app` and add that exact origin to Redirect URLs.
4. Registration uses email, username and password. Login accepts either email or username plus password.
5. Username-to-email mapping is stored in the server-only `account_lookup` table; the browser never receives another user's email address.
6. Enable leaked-password protection in Auth password security settings.
7. Keep `SUPABASE_SERVICE_ROLE_KEY` in Edge Function secrets only. Never add it to frontend code.

## 2. Production smoke test

Use a test account that you control. Never send passwords, confirmation links or recovery tokens to anyone.

1. Open the production URL and create an account using email, username and password.
2. Confirm the email using the message from Supabase Auth.
3. Sign in using the email address.
4. Sign out and sign in again using the username and the same password.
5. Refresh the page and confirm that the session is restored.
6. Edit the profile and confirm that the changes persist.
7. Publish a text post and confirm it appears in the feed after refresh.
8. Upload a photo, then a short supported video, and confirm each appears in the post.
9. Test likes, comments, post replies, follows, bookmarks and search.
10. Publish a Story and confirm it appears in the Stories area.
11. Test a one-to-one message, notifications and clan membership.
12. Submit a report on a test post and confirm it is stored for review.

## 3. Media rules

- Bucket: `orbis-media`.
- Photos: JPEG, PNG, WebP or GIF, up to 12 MB.
- Videos: MP4 or WebM, up to 50 MB.
- Maximum four files per post and one file per Story.
- Uploads require a valid authenticated session and are stored under the user's UUID.

## 4. Architecture notes

- Vercel is the current production host for the PWA and `api/news.js`.
- Supabase Auth handles account credentials and sessions.
- Supabase PostgreSQL stores profiles and social data.
- Supabase Storage stores post and Story media.
- Supabase Edge Function `orbis-api` validates access tokens and handles social actions.
- `src/index.js` and `wrangler.toml` describe an optional Cloudflare Worker path; it is not required for the current Vercel production URL.

## 5. Limits and launch safety

- The latest Vercel production deployment reported `READY`; this is not a substitute for the smoke test above.
- No full browser E2E suite or load test has been completed.
- Free-tier quotas can pause or throttle services.
- The app has report submission and basic anti-spam checks, but no full human moderation console yet.
- Do not advertise a user-capacity or concurrent-user figure until load testing supports it.
