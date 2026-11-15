# ORBIS

ORBIS is a Telegram-first social network with a cinematic orbital identity.

## Product rules
- Telegram Mini App is the only registration and sign-in method.
- Telegram Web App `initData` is verified server-side; never trust client-supplied Telegram IDs.
- Supabase Auth provides durable sessions and PostgreSQL stores account/profile and social metadata.
- Main feed, posts, reactions, replies, follows, bookmarks, Stories and topic Navigator are core product areas.
- Stories expire after 24 hours; daily publication limits are enforced by database unique indexes.
- Supabase Storage stores uploaded photos and videos for posts and Stories (one optional media file per Story).
- Private Telegram channels are optional archive destinations for posts, media and Stories; archive failure must not lose a successfully saved post. Configure `POSTS_CHANNEL_ID`, optionally `MEDIA_CHANNEL_ID` and `STORIES_CHANNEL_ID`.
- The app must never claim support for a traffic target until load tests prove it.

## Repository structure
- `public/index.html` — responsive web and Telegram Mini App UI, orbital intro, auth client and social screens.
- `src/index.js` — Cloudflare Worker serving static assets and RSS/news endpoints. Legacy KV-based social/auth endpoints are disabled.
- `wrangler.toml` — Cloudflare Worker and static asset configuration.
- `docs/ARCHITECTURE.md` — product and technical architecture.

## Supabase project
- Project ref: `wdwvcvpgovvkoodozbxf`
- Edge Functions: `orbis-telegram-auth`, `orbis-api`
- Tables: `profiles`, `account_lookup`, `posts`, `post_likes`, `follows`, `bookmarks`, `stories`, `post_reports`
- Storage bucket: `orbis-media`
- RLS is enabled on all public application tables. The private account lookup table denies direct client access.
- The browser only receives the Supabase publishable key. The service-role key and Telegram bot token must remain in Edge Function secrets.

## Required owner configuration before live use
1. Set `TELEGRAM_BOT_TOKEN` in Supabase Edge Function secrets.
2. Configure the official Telegram bot's Mini App URL to the deployed HTTPS frontend.
3. Configure Cloudflare Worker deployment and the required KV binding for RSS cache/rate limiting.
4. Verify the deployed site opens inside Telegram and returns valid `Telegram.WebApp.initData`.
5. Run the end-to-end checklist in `docs/SUPABASE_SETUP.md`.

## Known limits
- The repository being public on GitHub does not mean a website is deployed.
- The database currently has no user profiles, posts or Stories; the first real Telegram sign-in creates the first account.
- No full browser E2E suite or load test has been completed in this session.
- Free-tier quotas can pause or throttle a project. Zero-budget operation is the target, not a guarantee of unlimited usage.
- RSS/news still runs through the Cloudflare Worker and its KV cache.
