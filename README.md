# ORBIS

ORBIS is a Telegram-first social network with a cinematic orbital identity.

## Product rules

- Telegram is the only registration and sign-in provider.
- Telegram Mini App `initData` is verified server-side; ordinary browser sign-in uses Telegram OIDC Authorization Code + PKCE and server-side ID-token signature/claim validation.
- Both Telegram entry points resolve to the same profile using the Telegram user ID.
- Supabase Auth provides durable sessions; PostgreSQL stores profiles and social data.
- The feed uses paginated queries. Posts support likes, comments, post replies, media and bookmarks.
- Comments are stored separately from posts and loaded 20 at a time.
- Stories support text, photo or video and expire after 24 hours.
- Supabase Storage is the only media store. A Story can include one media file; a post can include up to four.
- Private Telegram channels are optional archive destinations for posts, media and Stories.
- Rate limits protect sign-in, comments, likes, search, media uploads, reports, follows and bookmarks.
- Aggregate database views keep like/comment/topic counts out of large row-by-row scans.
- Do not claim a traffic target until load tests prove it.

## Repository structure

- `public/index.html` — responsive web and Telegram Mini App UI, orbital intro, Telegram sign-in, feed, comments, Stories, profile and Navigator.
- `public/manifest.webmanifest`, `public/sw.js`, `public/orbis-icon.svg` — installable PWA shell and icon.
- `src/index.js` — Cloudflare Worker serving static assets and RSS/news endpoints only.
- `wrangler.toml` — Cloudflare Worker, static assets and RSS KV configuration.
- `docs/ARCHITECTURE.md` — product and technical architecture.
- `docs/DEPLOYMENT.md` — Cloudflare, Supabase and Telegram launch checklist.

## Supabase project

- Project ref: `wdwvcvpgovvkoodozbxf`
- Edge Functions: `orbis-telegram-auth`, `orbis-api`
- Core tables: `profiles`, `account_lookup`, `posts`, `post_likes`, `post_comments`, `follows`, `bookmarks`, `stories`, `post_reports`
- Internal rate-limit table: `api_rate_limits`
- Aggregate views: `post_like_counts`, `post_comment_counts`, `post_topic_counts`
- Storage bucket: `orbis-media`
- RLS is enabled on application tables. The private account lookup, comments and rate-limit data are not directly accessible to browser roles.
- The browser only receives the Supabase publishable key. The service-role key and Telegram bot token remain in Edge Function secrets.

## Required owner configuration before live use

1. Set `TELEGRAM_BOT_TOKEN` in Supabase Edge Function secrets.
2. For browser sign-in, also set `TELEGRAM_LOGIN_CLIENT_ID`, `TELEGRAM_LOGIN_CLIENT_SECRET` and the exact HTTPS `TELEGRAM_LOGIN_REDIRECT_URI` in Supabase Edge Function secrets. Register the website origin and redirect URI in BotFather → Login Widget. Cloudflare secrets are not shared with Supabase.
2. Configure the official Telegram bot's Mini App URL to the deployed HTTPS frontend.
3. In Cloudflare Worker settings, remove any stale `ORBIS_MEDIA` R2 binding. ORBIS uses Supabase Storage and does not require an R2 bucket.
4. Confirm the `ORBIS_KV` namespace ID in `wrangler.toml`.
5. Deploy with `npx wrangler deploy`.
6. Run the end-to-end checklist in `docs/DEPLOYMENT.md`.

## Known limits

- A GitHub commit does not automatically publish the site.
- The database had no user profiles, posts or Stories at the last inspection; the first real Telegram sign-in has not yet been verified.
- No complete browser E2E suite or load test has been completed.
- Free-tier quotas can pause or throttle a project. Zero-budget operation is the target, not a guarantee of unlimited capacity.
- A complete human moderation console, direct messages, notification center, clans, Stars/Premium and ad management are not yet implemented.
