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

## Notes
No load test has been run, so there is no verified concurrent-user capacity claim. Cloudflare/Supabase quotas still apply. Offline mode caches the app shell, not live posting or feed updates.
