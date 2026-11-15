# ORBIS — Supabase setup

## What is deployed
- Supabase project: `Orbis` (`wdwvcvpgovvkoodozbxf`)
- PostgreSQL schema: profiles, account_lookup, posts, post_likes, follows, bookmarks, stories, post_reports
- RLS enabled on every public table
- Edge Functions: `orbis-telegram-auth` and `orbis-api`
- Frontend: Supabase client + Telegram Mini App authentication + API routing to Edge Functions

## Required one-time configuration
1. In Supabase Dashboard, open Project Settings → Edge Functions → Secrets.
2. Add `TELEGRAM_BOT_TOKEN` with the token of the official ORBIS Telegram bot. Never put this token in browser code, GitHub, or a public repository.
3. Confirm the Edge Function runtime has its standard `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` secrets.
4. Configure the Telegram bot's Mini App / menu button to open the deployed ORBIS frontend URL. The app must be opened inside Telegram so `Telegram.WebApp.initData` is present.
5. Configure the frontend hosting domain and HTTPS. The GitHub repository alone is source code; it does not publish a website automatically.

## Important current limitations
- The Telegram bot token and hosting URL must be supplied/configured by the project owner; neither is embedded in the repository.
- Media upload endpoint currently returns a clear 503 until a Supabase Storage bucket and its access policies are configured.
- The RSS news pages still use the existing Worker endpoints; their KV binding must remain configured or those pages will fail.
- Stories and bookmarks have database/API foundations; their complete UI screens still need to be connected.
- No load test has been run. Free-tier capacity is not a promise of support for 10,000 concurrent users.
- Never expose the Supabase service-role key in frontend JavaScript. Only the publishable key belongs in the browser.

## Account model
Telegram Mini App initData is verified server-side using the bot token. A corresponding Supabase Auth user and public profile are created on first sign-in. The private account lookup table is not readable by browser roles.
