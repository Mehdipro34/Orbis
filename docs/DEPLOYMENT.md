# ORBIS deployment checklist

This repository contains the application source. A GitHub commit does not automatically publish it.

## 1. Supabase Auth configuration

Open the ORBIS Supabase project → Authentication → Sign In / Providers.

1. Enable **Anonymous Sign-Ins**. ORBIS creates a guest session automatically; visitors do not enter an email, password or username.
2. Do not require email confirmation for guest access. The email provider is not used by the current guest-first frontend.
3. Anonymous users are real Supabase Auth users with their own guest profile, posts, likes and media. Their session is remembered in that browser.
4. Important: a guest cannot recover the same identity after clearing browser data, signing out, or switching devices. Do not clear site data if you want to keep access to a guest profile.
5. Supabase recommends anti-abuse protection such as CAPTCHA/Turnstile for public anonymous sign-in. Add it before promoting ORBIS broadly.

The frontend calls Supabase Auth `signInAnonymously()`. The Edge Function creates a stable guest username from the anonymous user's UUID. Passwords and email addresses are not requested.

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

## 3. Guest access and first post

1. Open the ORBIS HTTPS site. It should create a guest session and enter the app without showing a registration screen.
2. Confirm a profile appears in Supabase `profiles` with a username beginning `guest_`.
3. Publish a text post, then test a like, comment, bookmark and follow.
4. Upload a photo or video. The upload endpoint stores it in `orbis-media` under the guest user's UUID; the feed renders the media with the post.
5. Refresh the page. The same guest profile and its posts should still be available in that browser.

## 4. First live smoke test

After deployment and configuration:

- Open `/health` on the Worker URL; expect `ok: true`.
- Open `/api/news/sources`; expect four configured news sources.
- Open the site and verify it enters guest mode without asking for registration.
- Confirm one profile appears in Supabase `profiles` with the selected username.
- Publish one test post; confirm it appears in the Supabase feed.
- Add a comment and a like; confirm counts update and comments load 20 at a time.
- Upload a photo to a post and a Story; confirm media appears in the `orbis-media` bucket.
- Test like, comment, reply-as-post, follow, bookmark, profile edit, report, logout and a fresh sign-in.
- Install the PWA from the browser menu on a supported device. The service worker caches the static shell only; social actions still need internet.

## 5. Limits and safety

- The database was empty at the last project inspection. Guest-mode end-to-end use still needs to be verified after Anonymous Sign-Ins are enabled.
- Do not announce a public launch until the full smoke test is complete.
- Free tiers have quotas and can pause/throttle. There is no verified guarantee of 10,000 or 100,000 concurrent users.
- Keep the Supabase service-role key private.
- The project has report submission, lightweight rule-based anti-spam checks and per-user rate limits. It does not yet have a complete human moderation console or proven automated AI moderation.
- Direct messages, a notification center, clans, Stars/Premium and ad management are not yet implemented.
