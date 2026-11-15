# ORBIS — Supabase setup

## What is deployed
- Supabase project: `Orbis` (`wdwvcvpgovvkoodozbxf`)
- PostgreSQL schema: profiles, account_lookup, posts, post_likes, post_comments, follows, bookmarks, stories, post_reports, api_rate_limits
- RLS enabled on all ten application tables
- Direct client reads of `profiles` are column-restricted: legacy Telegram identifiers are only readable by the server-side service role
- Edge Function: `orbis-api` (the legacy Telegram auth function is unused)
- Frontend: Supabase client + email/password authentication + API routing to Edge Functions

## Required one-time configuration
1. In Supabase Dashboard, open Authentication → Sign In / Providers and ensure the Email provider is enabled.
2. Keep email confirmation enabled. Set Authentication → URL Configuration → Site URL to the deployed ORBIS HTTPS origin and add the exact origin/path used by the frontend to Redirect URLs.
3. Confirm the Edge Function runtime has its standard `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets. Never expose the service-role key in browser code.
4. Configure the frontend hosting domain and HTTPS. The GitHub repository alone is source code; it does not publish a website automatically.

## Important current limitations
- The hosting URL and Supabase Auth redirect allow-list must be configured by the project owner; no passwords or service-role secrets are embedded in the repository.
- The `orbis-media` Supabase Storage bucket exists. The API uploads through the server-side service-role client; the bucket is public-read for media URLs. Confirm the bucket configuration before production use. Cloudflare R2 is not required.
- The RSS news pages still use the existing Worker endpoints; their KV binding must remain configured or those pages will fail.
- Stories, bookmarks and comments have UI and API routes. Stories support text plus one photo/video and expire after 24 hours; one Story per author per UTC day is enforced by a unique index. Comments are paginated at 20 per request and stored separately from posts.
- No load test has been run. Free-tier capacity is not a promise of support for 10,000 concurrent users.
- Never expose the Supabase service-role key in frontend JavaScript. Only the publishable key belongs in the browser.

## Account model
Supabase Auth stores email/password credentials and issues persistent sessions. On the first authenticated request, `orbis-api` validates the access token, reads the username/display name metadata created during signup, and inserts the matching `profiles` row using the server-side service-role client. Passwords are never stored in the public profile table.

## Current end-to-end checks
- Frontend inline JavaScript blocks were syntax-compiled successfully.
- HTML document tags and CSS brace pairs were checked.
- Supabase project reports ACTIVE_HEALTHY.
- Both Edge Functions are ACTIVE; `orbis-api` is deployed at version 19. The legacy Telegram auth function is not called by the current frontend.
- Security Advisor currently returns no findings.
- All ten application tables have RLS enabled. The latest Security Advisor run returned no findings.
- Database currently has zero profiles, posts and Stories; no live user registration has yet been verified.
- A real email registration cannot be tested until the owner configures the Supabase Auth Site URL/Redirect URLs and confirms the email provider settings.
- The Cloudflare Worker remains responsible for RSS/news only. Core social/auth endpoints are disabled there to prevent a second KV-based account store.


## Profile privacy hardening
The `profiles` table contains Telegram identifiers for server-side account matching. Direct `anon` and `authenticated` table-wide SELECT was revoked; only safe profile columns are granted. Legacy `telegram_id` and `telegram_username` fields are not used by the email-first frontend and are not exposed through the browser Data API. Do not add these fields to public profile responses.


## Installable app
ORBIS includes a web app manifest, SVG app icon and service worker; installation is available through the browser menu on supported devices. The service worker caches only the static app shell; account, feed and media actions still require a network connection. The site must be served over HTTPS for browser installation. The visible landing-page CTA opens Telegram sign-in; installation remains available through the browser menu.
