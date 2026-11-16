# ORBIS deployment and staged load-test guide

## Current hosting model
- Production application: `https://orbis-mehdipro34.vercel.app` (the exact alias is verified from Vercel deployment records).
- Vercel automatically deploys pushes to `main`.
- PWA files: `public/`.
- Public cacheable feed route: `api/public/posts.js`.
- Social API and persistent database: Supabase Edge Function `orbis-api`.
- Media: Supabase Storage bucket `orbis-media`.

## Cloudflare Worker option
The repository includes `src/index.js`, `wrangler.toml` and `.github/workflows/deploy-cloudflare.yml`.
The Worker:
- serves static assets from `public/`;
- caches unauthenticated public-feed pages for 60 seconds using the Cache API;
- proxies cache misses to the Supabase public-feed endpoint;
- does not cache authenticated writes or per-user state.

To activate it, add GitHub Actions secrets:
- `CF_API_TOKEN`: Cloudflare API token with Workers Scripts edit and account read permissions.
- `CF_ACCOUNT_ID`: the Cloudflare account ID.

Then check the GitHub Actions run. A commit to GitHub alone does not prove the Worker was deployed. No paid Cloudflare plan is enabled by this repository.

## Smoke-test checklist
Use a test account that you control. Never publish recovery codes or private keys.

1. Open the production URL and register with a unique username and bio.
2. Download the encrypted recovery file and keep the displayed recovery code separately.
3. Refresh and confirm the local key signs in automatically.
4. Import the recovery file on a separate browser profile and confirm access is restored.
5. Publish text-only content.
6. Publish a post with multiple photos; verify they appear in the global feed.
7. Like/unlike, save/unsave, create a comment, create a one-level reply and test notifications.
8. Follow/unfollow another test profile and verify the following feed.
9. Edit profile name/bio and upload an avatar.
10. Edit and delete a post you own; verify another account cannot do so.
11. Go offline after loading the feed and confirm cached posts render. Confirm writes fail clearly while offline rather than pretending they were saved.

## Staged load test
Do not run a 100,000-VU test against the free production project. First use a separate staging project and a low request rate. Measure:
- cache hit ratio and cache age;
- p50/p95/p99 response latency;
- Supabase Edge Function invocation count;
- PostgreSQL CPU/active connections and slow queries;
- Storage egress and upload failures;
- API 429/5xx rates.

Ramp in controlled steps (for example 10, 25, 50, 100, 250, 500 and 1,000 virtual users), pause to inspect metrics between steps, and stop on rising 5xx, sustained high database CPU, connection saturation or quota warnings. Move to larger tests only after the previous step is stable and the account owner has approved the expected traffic.

## Free-tier guardrails (checked Nov 16, 2026)
- Cloudflare Workers Free: 100,000 Worker requests/day and 10 ms CPU per invocation.
- Cloudflare Workers KV Free: 100,000 reads/day and 1,000 writes/day. The public-feed Worker uses Cache API rather than writing every view to KV.
- Supabase Free: 500,000 Edge Function invocations/month, 500 MB database size, 1 GB Storage and 5 GB egress; the Free database may pause after a week of inactivity.
- Vercel Hobby: 1,000,000 function invocations/month. Hobby is intended for personal, non-commercial usage and is subject to fair-use limits.

These are quotas, not a promise of users or concurrency. With 100,000 active users, posts, likes, comments, follows, notification reads, personal state calls and image delivery can exceed free quotas. Do not enable paid features or upgrades without explicit approval.
