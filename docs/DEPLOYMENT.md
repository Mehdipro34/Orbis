# ORBIS deployment checklist

This repository contains the application source. A GitHub commit does not automatically publish it.

## 1. Supabase secrets

Open the ORBIS Supabase project → Project Settings → Edge Functions → Secrets.

Required:
- `TELEGRAM_BOT_TOKEN` — token of the official ORBIS bot for Mini App `initData` verification. Never commit it or paste it into chat.

For browser sign-in through Telegram Login (OIDC), also add these three secrets:
- `TELEGRAM_LOGIN_CLIENT_ID` — public Client ID shown in BotFather → your bot → Login Widget.
- `TELEGRAM_LOGIN_CLIENT_SECRET` — matching Client Secret from the same BotFather screen. Keep it server-side; never put it in frontend code.
- `TELEGRAM_LOGIN_REDIRECT_URI` — exact HTTPS callback URL, for example `https://YOUR-WORKER-DOMAIN/`. Replace the example with the real deployed ORBIS URL, including the trailing slash if registered that way.

The browser login code uses Authorization Code + PKCE, validates Telegram's ID-token signature, issuer, audience, expiry and nonce, then maps the Telegram user ID to the same ORBIS profile used by Mini Apps. Cloudflare Worker secrets and Supabase Edge Function secrets are separate: a value stored in Cloudflare is not automatically readable by Supabase. Add the same Telegram Login Client Secret in Supabase under the exact name above; do not paste it into GitHub or chat.

In BotFather → Login Widget, register both the ORBIS website origin (for example `https://YOUR-WORKER-DOMAIN`) and the exact `TELEGRAM_LOGIN_REDIRECT_URI`. They must match the deployed website and callback URL.

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

This binding is stored in Cloudflare account settings, not in the GitHub repository. Changing source files alone will not remove it.

## 3. Telegram Mini App and browser login

1. Open the official bot in Telegram and use BotFather to configure its Menu Button / Mini App URL.
2. Set the URL to the HTTPS Worker URL from step 2.
3. For browser login, configure Telegram Login in BotFather → Login Widget and add the website origin plus the exact callback URL from Supabase secrets.
4. Open ORBIS in a normal browser and test **Continue through Telegram**. Telegram should return to the registered HTTPS callback; ORBIS then exchanges the authorization code server-side.
5. Open ORBIS from the Telegram bot and test the Mini App path. It continues to verify signed Telegram `initData`.
6. Confirm both paths resolve to the same Telegram-linked ORBIS profile.

The browser OIDC flow will return a clear configuration error until all three `TELEGRAM_LOGIN_*` secrets are set in Supabase and the matching URLs are registered in BotFather.

The server validates signed Mini App `initData` or the OIDC authorization code and signed ID token; never accept Telegram IDs supplied directly by the browser.

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
