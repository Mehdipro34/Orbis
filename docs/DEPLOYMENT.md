# ORBIS deployment checklist

This repository contains the application source. A GitHub commit does not automatically publish it.

## 1. Supabase secrets

Open the ORBIS Supabase project → Project Settings → Edge Functions → Secrets.

Required:
- `TELEGRAM_BOT_TOKEN` — token of the official ORBIS bot. Never commit it or paste it into chat.

Optional Telegram archive destinations:
- `POSTS_CHANNEL_ID` — private channel for post text.
- `MEDIA_CHANNEL_ID` — private channel for post photos/videos. If omitted, post media is sent to `POSTS_CHANNEL_ID`.
- `STORIES_CHANNEL_ID` — private channel for Stories.

Add the bot as an administrator to each channel and allow it to post. If archive channel IDs are not configured, posts and Stories still save in Supabase and the UI/API returns an archive warning.

Supabase Edge Functions use their project environment for `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Never place the service-role key in frontend code.

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

The Cloudflare account-management connector is not available in this session, so this dashboard-only binding cannot be removed remotely from here.

## 3. Telegram Mini App

1. Open the official bot in Telegram and use BotFather to configure its Menu Button / Mini App URL.
2. Set the URL to the HTTPS Worker URL from step 2.
3. Open ORBIS from that Telegram bot, not by typing the URL into a normal browser for first-time sign-in.
4. Tap **Continue through Telegram** and approve the Mini App launch.

The server validates Telegram `initData`; do not accept Telegram IDs supplied by the browser.

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
