# ORBIS deployment checklist

This repository contains the application source. A GitHub commit does not automatically publish it.

## 1. Supabase Auth configuration

Open the ORBIS Supabase project → Authentication → Sign In / Providers.

1. Enable the Email provider and keep email confirmation enabled.
2. Open Authentication → URL Configuration.
3. Set **Site URL** to the deployed ORBIS HTTPS origin.
4. Add the exact ORBIS origin/path to **Redirect URLs**. The frontend requests a confirmation redirect to the current ORBIS page.
5. Supabase's default email sender on the Free plan is best-effort and rate-limited; for a small test, avoid repeated signup attempts. A custom SMTP provider is optional and may have its own pricing/limits.

The browser uses Supabase Auth `signUp()` and `signInWithPassword()`. Passwords are handled by Supabase Auth and are never written to `profiles` or the application database. The server verifies each access token before creating the matching ORBIS profile.

Supabase Edge Functions use their project environment for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never place the service-role key in frontend code.

## 2. Cloudflare Worker

The Worker serves the static PWA and the RSS/news proxy. The social API and account system are served by Supabase.

1. Sign in to the Cloudflare account that owns the Worker.
2. Confirm a Workers KV namespace exists with ID matching `ORBIS_KV` in `wrangler.toml`. If it does not, create one and replace the ID in that file.
3. From the repository root, install Wrangler if needed and authenticate:
   ```sh
   npm install --global wrangler
   wrangler login
   ```
4. Deploy:
   ```sh
   wrangler deploy
   ```
5. Save the HTTPS `workers.dev` URL returned by Wrangler.

No R2 bucket is required. User media is stored in Supabase Storage. The Worker KV namespace is only used for RSS cache and news rate limiting.

### Fix the current Cloudflare error 10085

The supplied build log shows a stale dashboard binding named `ORBIS_MEDIA` pointing to an R2 bucket that does not exist. It is not present in the current `wrangler.toml`, and the current Worker source does not use R2.

In Cloudflare Dashboard:
1. Open **Workers & Pages** → **orbissocial**.
2. Open **Settings** → **Bindings**.
3. Find the R2 bucket binding named **ORBIS_MEDIA**.
4. Remove that binding and save the settings. Do not create an R2 bucket for this project; Supabase Storage is the single media store.
5. Retry the existing Worker deployment. The build log should list `ASSETS` and `ORBIS_KV`, and should no longer list `ORBIS_MEDIA`.

This binding is stored in Cloudflare account settings, not in the GitHub repository. Changing source files alone will not remove it.

## 3. Email registration and login

1. Open the ORBIS HTTPS site in a normal browser.
2. Choose **Регистрация**, enter a unique username, email address and password, then confirm the password.
3. Open the confirmation email and follow its link. The link should return to the ORBIS URL configured in Supabase Auth.
4. Sign in with the same email and password. The API creates the user's public profile on the first authenticated request.
5. Publish a text-only post or attach photos/videos. The upload endpoint stores files in the `orbis-media` bucket under the user's account ID; the post stores the media metadata and the feed renders the uploaded files.
6. Sign out and sign in again to confirm the account, profile and posts persist.

## 4. First live smoke test

After deployment and configuration:

- Open `/health` on the Worker URL; expect `ok: true`.
- Open `/api/news/sources`; expect four configured news sources.
- Open ORBIS through Telegram and complete the first sign-in.
- Confirm one profile appears in Supabase `profiles` and its private mapping appears in `account_lookup`.
- Publish one test post; confirm it appears in the Supabase feed.
- Add a comment and a like; confirm counts update and comments load 20 at a time.
- Upload a photo to a post and a Story; confirm media appears in the `orbis-media` bucket.
- If archive channels are configured, confirm Telegram receives the post, media and Story.
- Test like, comment, reply-as-post, follow, bookmark, profile edit, report, logout and a fresh sign-in.
- Install the PWA from the browser menu on a supported device. The service worker caches the static shell only; social actions still need internet.

## 5. Limits and safety

- The database was empty at the last project inspection. The first real Telegram sign-in has not yet been completed or verified.
- Do not announce a public launch until the full smoke test is complete.
- Free tiers have quotas and can pause/throttle. There is no verified guarantee of 10,000 or 100,000 concurrent users.
- Keep the service-role key and bot token private.
- The project has report submission, lightweight rule-based anti-spam checks and per-user rate limits. It does not yet have a complete human moderation console or proven automated AI moderation.
- Direct messages, a notification center, clans, Stars/Premium and ad management are not yet implemented.
