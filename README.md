# ORBIS

ORBIS is an email-first social network with a cinematic orbital identity.

## Product rules

- Registration and sign-in use email + password through Supabase Auth; Telegram is not required.
- Supabase Auth provides durable sessions; PostgreSQL stores profiles and social data.
- The feed uses paginated queries. Posts support likes, comments, post replies, media and bookmarks.
- Comments are stored separately from posts and loaded 20 at a time.
- Stories support text, photo or video and expire after 24 hours.
- Supabase Storage is the only media store. A Story can include one media file; a post can include up to four.
- Supabase Storage is the canonical media store; uploaded photos/videos are attached to posts and rendered in the feed.
- Rate limits protect sign-in, comments, likes, search, media uploads, reports, follows and bookmarks.
- Aggregate database views keep like/comment/topic counts out of large row-by-row scans.
- Do not claim a traffic target until load tests prove it.

## Repository structure

- `public/index.html` — responsive web app UI, orbital intro, email sign-in, feed, comments, Stories, profile and Navigator.
- `public/manifest.webmanifest`, `public/sw.js`, `public/orbis-icon.svg` — installable PWA shell and icon.
- `src/index.js` — Cloudflare Worker serving static assets and RSS/news endpoints only.
- `wrangler.toml` — Cloudflare Worker, static assets and RSS KV configuration.
- `docs/ARCHITECTURE.md` — product and technical architecture.
- `supabase/functions/orbis-api/index.ts` — deployed social API, email profile provisioning and media upload endpoint.
- `docs/DEPLOYMENT.md` — Cloudflare and Supabase launch checklist.

## Supabase project

- Project ref: `wdwvcvpgovvkoodozbxf`
- Edge Functions: `orbis-api` (the older Telegram auth function is no longer used by the frontend)
- Core tables: `profiles`, `account_lookup`, `posts`, `post_likes`, `post_comments`, `follows`, `bookmarks`, `stories`, `post_reports`
- Internal rate-limit table: `api_rate_limits`
- Aggregate views: `post_like_counts`, `post_comment_counts`, `post_topic_counts`
- Storage bucket: `orbis-media`
- RLS is enabled on application tables. The private account lookup, comments and rate-limit data are not directly accessible to browser roles.
- The browser only receives the Supabase publishable key. The service-role key remains in Edge Function secrets.

## Required owner configuration before live use

1. Enable the Email provider in Supabase Authentication.
2. Set the Supabase Auth Site URL to the deployed ORBIS HTTPS origin and add that origin/path to the Redirect URLs allow-list. The frontend sends email-confirmation links back to the current ORBIS URL.
3. Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available to the Edge Function runtime; never expose the service-role key in browser code.
4. Confirm the `orbis-media` Storage bucket exists and is configured for public media URLs. The API validates each upload and stores it under the signed-in user's UUID.
5. Confirm the `ORBIS_KV` namespace ID in `wrangler.toml`.
6. Deploy the Cloudflare Worker with `npx wrangler deploy` and run the end-to-end checklist in `docs/DEPLOYMENT.md`.

## Known limits

- A GitHub commit does not automatically publish the site.
- The database had no user profiles, posts or Stories at the last inspection; email registration, email confirmation and first real sign-in have not yet been verified.
- No complete browser E2E suite or load test has been completed.
- Free-tier quotas can pause or throttle a project. Zero-budget operation is the target, not a guarantee of unlimited capacity.
- A complete human moderation console, direct messages, notification center, clans, Stars/Premium and ad management are not yet implemented.
