# ORBIS

ORBIS is a social network with a dark, orbital visual identity and an installable PWA interface.

## Current production deployment

- Production URL: https://orbis-mehdipro34.vercel.app
- Vercel production deployments are connected to the GitHub `main` branch.
- Vercel serves the static app from `public/` and the RSS endpoint from `api/news.js`.
- Supabase project: `wdwvcvpgovvkoodozbxf` (`Orbis`).
- Supabase Edge Function: `orbis-api` (active version 27 at the latest verification).

## Account model

- Registration: email + unique username + password.
- Login: email or username + password.
- Email confirmation is required when enabled in Supabase Auth.
- Username-to-email lookup is performed server-side through `account_lookup`; that table is not readable by browser roles.
- Passwords are stored and verified by Supabase Auth, never in public profile rows.
- Password reset is sent to the account email.

## Implemented social features

- Paginated home feed and topic navigation.
- Text, photo and video posts; up to four media files per post.
- Likes, separate comments, post replies, follows and bookmarks.
- User profiles and profile editing.
- Search for users and posts.
- 24-hour Stories with text or one photo/video.
- One-to-one direct messages.
- Notifications with read/unread state.
- Clans, with one clan membership per user.
- Post reports and basic rule-based anti-spam checks.
- Basic ad-campaign API and screens.
- Per-user API rate limits.
- Installable PWA shell and app icon.

## Media storage

- Supabase Storage bucket: `orbis-media`.
- Photos: JPEG, PNG, WebP or GIF, up to 12 MB each.
- Videos: MP4 or WebM, up to 50 MB each.
- A post can include up to four files; a Story can include one file.
- Media uploads are authenticated and stored under the user's UUID.

## Repository structure

- `public/index.html` — responsive ORBIS interface, authentication screen, feed, Stories, profiles and social screens.
- `public/orbis-social.js` — direct messages, notifications and clans UI.
- `public/manifest.webmanifest`, `public/sw.js`, `public/orbis-icon.svg` — installable PWA shell.
- `api/news.js` — Vercel serverless RSS/news endpoint.
- `supabase/functions/orbis-api/index.ts` — authenticated social API, media upload, account lookup and social actions.
- `src/index.js` and `wrangler.toml` — optional Cloudflare Worker deployment path; not required for the current Vercel production deployment.
- `docs/` — architecture, deployment and Supabase setup notes.

## Required owner configuration

1. In Supabase Authentication → Sign In / Providers, ensure Email is enabled.
2. In Supabase Authentication → URL Configuration, set the Site URL and Redirect URLs to include `https://orbis-mehdipro34.vercel.app`.
3. Keep the Supabase service-role key only in Edge Function secrets. Never put it in browser code.
4. Enable leaked-password protection in Supabase Auth password security settings before inviting a wider audience.
5. Confirm that the Supabase Storage bucket `orbis-media` remains available and public-read for media URLs.

## Known limits and verification status

- The database currently has one profile and no posts or Stories. A real end-to-end registration, email confirmation, username login and media-upload test has not yet been completed.
- The latest Vercel production deployment reported `READY`; this confirms deployment completion, not a full browser test of every feature.
- Direct messages are one-to-one; group chats and live real-time message delivery are not implemented.
- A full human moderation console, advanced moderation workflows and Stars/Premium are not yet implemented.
- No load test has been completed. Do not claim support for a specific number of concurrent users until measured.
- Free-tier quotas can pause or throttle a project. Zero-budget operation is a target, not a guarantee of unlimited capacity.
