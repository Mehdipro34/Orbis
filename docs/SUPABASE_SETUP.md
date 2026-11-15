# ORBIS — Supabase setup

## What is deployed
- Supabase project: `Orbis` (`wdwvcvpgovvkoodozbxf`)
- PostgreSQL schema: profiles, account_lookup, posts, post_likes, follows, bookmarks, stories, post_reports
- RLS enabled on every public table
- Edge Functions: `orbis-telegram-auth` and `orbis-api`
- Frontend: Supabase client + Telegram Mini App authentication + API routing to Edge Functions

## Required one-time configuration
1. In Supabase Dashboard, open Project Settings → Edge Functions → Secrets.
2. Add `TELEGRAM_BOT_TOKEN` with the token of the official ORBIS Telegram bot. Never put this token in browser code, GitHub, or a public repository. The same token is used for sign-in validation and optional channel archiving.
3. Confirm the Edge Function runtime has its standard `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` secrets.
4. Add `POSTS_CHANNEL_ID` for the private posts archive. Optionally add `MEDIA_CHANNEL_ID` for media and `STORIES_CHANNEL_ID` for Stories. Add the bot as an administrator with permission to post in each private channel. If a channel ID is missing, content still saves to Supabase and the API returns an archive warning.\n5. Configure the Telegram bot's Mini App / menu button to open the deployed ORBIS frontend URL. The app must be opened inside Telegram so `Telegram.WebApp.initData` is present.
6. Configure the frontend hosting domain and HTTPS. The GitHub repository alone is source code; it does not publish a website automatically.

## Important current limitations
- The Telegram bot token and hosting URL must be supplied/configured by the project owner; neither is embedded in the repository.
- The `orbis-media` Supabase Storage bucket exists. The API uploads through the server-side service-role client; the bucket is public-read for media URLs. Confirm the bucket configuration before production use.
- The RSS news pages still use the existing Worker endpoints; their KV binding must remain configured or those pages will fail.
- Stories and bookmarks have UI and API routes. Stories support text plus one photo/video and expire after 24 hours; one Story per author per UTC day is enforced by a unique index.
- No load test has been run. Free-tier capacity is not a promise of support for 10,000 concurrent users.
- Never expose the Supabase service-role key in frontend JavaScript. Only the publishable key belongs in the browser.

## Account model
Telegram Mini App initData is verified server-side using the bot token. A corresponding Supabase Auth user and public profile are created on first sign-in. The private account lookup table is not readable by browser roles.

## Current end-to-end checks
- Frontend inline JavaScript blocks were syntax-compiled successfully.
- HTML document tags and CSS brace pairs were checked.
- Supabase project reports ACTIVE_HEALTHY.
- Both Edge Functions are ACTIVE; `orbis-api` is deployed at version 4.
- Security Advisor currently returns no findings.
- All eight application tables have RLS enabled.
- Database currently has zero profiles, posts and Stories; no live user registration has yet been verified.
- A real Telegram sign-in cannot be tested until the owner sets the bot token secret and configures the official Mini App URL.
- The Cloudflare Worker remains responsible for RSS/news only. Core social/auth endpoints are disabled there to prevent a second KV-based account store.
