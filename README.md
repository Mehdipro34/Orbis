# ORBIS — One thought. One world.

ORBIS is a lightweight daily-topic social network. Everyone sees the same question for the day, each member can publish one short answer per 24 hours, and the whole community can react.

## Product
- One shared daily topic, rotated using the Asia/Baku calendar day.
- One-click guest identity with an automatically generated nickname; no email/password form.
- Shared public feed: latest, popular, and personal posts.
- 140-character posts with an atomic 24-hour server-side cooldown.
- Four reactions: 🔥 💎 🚀 😂 — one active reaction per member per post.
- Save posts, share post links, and search the feed.
- Russian, Azerbaijani and English interface.
- Installable PWA with an offline-cached app shell.
- Responsive dark-glass UI; no fake online counters or fake ad impressions.

## Architecture
- Frontend: `public/index.html`
- PWA: `public/manifest.webmanifest`, `public/sw.js`
- Cloudflare Worker assets: `src/index.js`, `wrangler.toml`
- Backend: Supabase Edge Function `supabase/functions/orbis-api/index.ts`
- Database: Supabase PostgreSQL tables for profiles, daily posts, reactions, bookmarks and cooldowns.
- The Edge Function validates a signed device guest token and performs writes with its server-side service role key. The service role key is never sent to the browser.
- The 24-hour post cooldown is atomic in PostgreSQL, not just a browser-side timer.

## Guest identity
Guest identity is tied to a device ID stored in the browser. Clearing site data or switching devices can make a guest profile inaccessible. Posts are visible to all ORBIS visitors. Do not share personal information.

## Cloudflare deployment
The repository includes `.github/workflows/deploy-cloudflare.yml`. Add repository Actions secrets:
- `CF_API_TOKEN`: Cloudflare API token with Workers Scripts edit and account read permissions.
- `CF_ACCOUNT_ID`: Cloudflare account ID.

After both secrets are configured, each push to `main` deploys the Worker and `public/` static assets using the existing `wrangler.toml` and KV namespace. The Worker URL / custom domain is managed in Cloudflare.

## Feed and reaction performance
- Feed responses are paginated in 40-post pages using a keyset cursor (created_at + post ID), so the API no longer tries to return the entire community history at once.
- Reaction totals are maintained in orbis_reaction_totals by a PostgreSQL trigger. Feed reads fetch up to four aggregate rows per post plus only the current member's own reactions, instead of downloading every member's reaction row.
- The browser refreshes an open feed about every 3 minutes with a small random delay, pauses while the tab is hidden, and refreshes when the member returns. Users can also refresh manually.
- Reaction and bookmark actions update the visible UI without reloading the whole feed. The app also has a bounded API timeout and staggered card/reaction motion.

## Capacity and free-tier reality
This is a more efficient starting architecture, not a promise of a specific concurrent-user count. Supabase Free currently includes 500,000 Edge Function invocations per month and 500 MB of database size per project; Cloudflare Workers Free currently lists 100,000 requests per day and 10 ms CPU time per invocation. The three-minute polling interval still consumes invocations: an illustrative 30 minutes of open-tab time per day is roughly 8–10 feed refreshes per member per day, before counting posts, reactions, bookmarks, and session checks. Thousands of daily active members may exceed the free quota. Capacity must be established by a realistic load test and usage monitoring before a public launch.
## Notes
No load test has been run, so there is no verified concurrent-user capacity claim. Cloudflare/Supabase quotas still apply. Offline mode caches the app shell, not live posting or feed updates.
