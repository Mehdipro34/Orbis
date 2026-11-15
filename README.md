# ORBIS

ORBIS is a guest-first social network with a cinematic orbital identity.

## Product rules

- Registration uses email, a unique username and a password. Login accepts either email or username plus password.
- Supabase Auth stores credentials and sessions; PostgreSQL stores public profiles and social data. Passwords and email addresses are not exposed in public profile responses.
- Email confirmation and the deployed site URL/redirect allow-list must be configured in Supabase Auth before public registration.
- The feed uses paginated queries. Posts support likes, comments, post replies, media and bookmarks.
- Comments are stored separately from posts and loaded 20 at a time.
- Stories support text, photo or video and expire after 24 hours.
- Supabase Storage is the only media store. A Story can include one media file; a post can include up to four.
- Supabase Storage is the canonical media store; uploaded photos/videos are attached to posts and rendered in the feed.
- Rate limits protect sign-in, comments, likes, search, media uploads, reports, follows and bookmarks.
- Aggregate database views keep like/comment/topic counts out of large row-by-row scans.
- Do not claim a traffic target until load tests prove it.

## Repository structure

- `public/index.html` — responsive web app UI, orbital intro, automatic guest access, feed, comments, Stories, profile and Navigator.
- `public/manifest.webmanifest`, `public/sw.js`, `public/orbis-icon.svg` — installable PWA shell and icon.
- `src/index.js` — Cloudflare Worker serving static assets and RSS/news endpoints only.
- `wrangler.toml` — Cloudflare Worker, static assets and RSS KV configuration.
- `docs/ARCHITECTURE.md` — product and technical architecture.
- `supabase/functions/orbis-api/index.ts` — deployed social API, automatic guest profile provisioning and media upload endpoint.
- `docs/DEPLOYMENT.md` — Cloudflare and Supabase launch checklist.

## Supabase project

- Project ref: `wdwvcvpgovvkoodozbxf`
- Edge Functions: `orbis-api` (the older Telegram auth function is no longer used by the frontend)
- Core tables: `profiles`, `account_lookup`, `posts`, `post_likes`, `post_comments`, `follows`, `bookmarks`, `stories`, `post_reports`
- Internal rate-limit table: `api_rate_limits`
- Aggregate views: `post_like_counts`, `post_comment_counts`, `post_topic_counts`
- Storage bucket: `orbis-media`
- RLS is enabled on application tables. The private account lookup, comments and rate-limit data are not directly accessible to browser roles.
- The browser only receives the Supabase publishable key. The service-role key remains in Edge Function secrets. The `account_lookup` table is server-only and maps usernames to email addresses for password login.

## Required owner configuration before live use

1. Ensure the **Email** provider is enabled in Supabase Authentication → Sign In / Providers.
2. Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available to the Edge Function runtime; never expose the service-role key in browser code.
3. Confirm the `orbis-media` Storage bucket exists and is configured for public media URLs. The API validates each upload and stores it under the guest user's UUID.
4. Confirm the `ORBIS_KV` namespace ID in `wrangler.toml`.
5. Deploy the Cloudflare Worker with `npx wrangler deploy` and run the end-to-end checklist in `docs/DEPLOYMENT.md`.

## Known limits

- A GitHub commit does not automatically publish the site.
- The database currently has one profile and no posts or Stories. No real end-to-end registration, email confirmation, username login or media upload has yet been completed.
- No complete browser E2E suite or load test has been completed.
- Free-tier quotas can pause or throttle a project. Zero-budget operation is the target, not a guarantee of unlimited capacity.
- A complete human moderation console, direct messages, notification center, clans, Stars/Premium and ad management are not yet implemented.
