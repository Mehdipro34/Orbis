# ORBIS — Your world. Your voice.

ORBIS is an international username-first social network. The main app is a responsive PWA for public posts, photos, profiles and community activity.

## Product features
- Username-first registration without email or phone.
- P-256 key-based login; an encrypted recovery file and separate recovery code protect account recovery.
- Public global feed, following feed and popular feed.
- Profiles with unique username, display name, bio and avatar.
- Text posts with up to four photos per post.
- Browser-side WebP compression before batched photo upload.
- Likes, bookmarks, comments and one-level replies.
- Follow/unfollow and notifications for likes, comments and follows.
- Russian, English and Azerbaijani interface.
- IndexedDB local feed cache and service-worker app-shell cache.
- No direct messages and no user/post search.

## Current architecture
- Static frontend: `public/index.html`, `public/orbis.css`, `public/orbis-app.js`.
- PWA: `public/manifest.webmanifest`, `public/sw.js`.
- Vercel API: `api/public/posts.js` proxies only public, non-personalised feed pages and sets shared CDN cache headers.
- Database and write API: Supabase PostgreSQL plus the Edge Function `orbis-api`.
- Media: Supabase Storage bucket `orbis-media`.
- Optional Cloudflare Worker: `src/index.js` and `wrangler.toml` provide a static-asset origin and edge cache for the public feed. It requires GitHub Actions secrets and is not assumed active until deployment is verified.

## Important data boundaries
- PostgreSQL is the source of truth. Browser caches never replace profiles, posts, likes, follows, comments or media.
- IndexedDB feed pages are per local account.
- CDN-cached public feed data contains no user-specific liked/saved state. That state is fetched separately in one batch per page.
- Media stays in persistent object storage, not only in a user's browser cache.
- Service Worker does not cache authenticated API responses.

## Development and operations
- Supabase migrations live under `supabase/migrations/`.
- Edge Function source lives in `supabase/functions/orbis-api/index.ts`.
- The main product architecture is described in `docs/ARCHITECTURE.md`.
- Deployment and staged testing guidance is in `docs/DEPLOYMENT.md`.
- Supabase access/security guidance is in `docs/SUPABASE_SETUP.md`.

## Free-tier reality
Current limits checked Nov 16, 2026:
- Cloudflare Workers Free: 100,000 Worker requests/day and 10 ms CPU per invocation.
- Cloudflare Workers KV Free: 100,000 reads/day and 1,000 writes/day.
- Supabase Free: 500,000 Edge Function invocations/month, 500 MB database, 1 GB Storage, 5 GB egress.
- Vercel Hobby: 1,000,000 function invocations/month and is intended for personal, non-commercial projects.

CDN caching and local caching reduce duplicate feed reads, but cache hits still count as inbound edge requests. User actions still use the authenticated API. The current build has not been load-tested at 100,000 concurrent users; no such capacity claim is made.

## Safety and privacy
Never expose `SUPABASE_SERVICE_ROLE_KEY` or the guest HMAC signing secret in frontend code. Recovery files contain encrypted private-key material; store the recovery file and code separately.
