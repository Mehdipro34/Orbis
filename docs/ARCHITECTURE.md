# ORBIS — Social Network Architecture

## Product scope
ORBIS is an international, username-first social network. The shipped interface contains:
- A global public feed, a following feed and a popular feed.
- User profiles with username, display name, bio and avatar.
- Text posts and up to four photo attachments per post.
- Likes, bookmarks, comments and one-level replies.
- Follow/unfollow and notifications for likes, comments and new followers.
- Russian, English and Azerbaijani interface.
- Responsive PWA with a service-worker app shell and IndexedDB feed cache.

User discovery/search and direct messages are intentionally not part of this product scope.

## Runtime architecture
- **Frontend:** static HTML/CSS/JavaScript in `public/`; no client framework or build step.
- **Production hosting:** Vercel currently serves the PWA and the cacheable public-feed API route.
- **Optional edge path:** `src/index.js` and `wrangler.toml` define a Cloudflare Worker that serves the same assets and caches public feed pages using the Cloudflare Cache API. This Worker is not considered active until its GitHub Actions deployment is confirmed.
- **Persistent data:** Supabase PostgreSQL stores profiles, posts, likes, follows, bookmarks, comments, notifications, rate-limit windows and key challenges.
- **Server API:** Supabase Edge Function `orbis-api` validates signed guest tokens and performs writes using its server-side service-role key. The service-role key is never shipped to the browser.
- **Media:** Supabase Storage bucket `orbis-media` stores uploaded photos. The browser compresses photos to WebP before batching them into one upload request. Public object URLs are delivered through the storage CDN.

## Authentication and recovery
- Registration needs only a unique username and optional bio; no email or phone number is requested.
- Each browser profile receives a random UUID and a P-256 ECDSA key pair.
- The private key is kept as a non-exportable CryptoKey in IndexedDB on the device.
- The server stores only the public key. Login uses a short-lived, single-use challenge signed by the private key; the server then issues a 30-day signed guest token.
- A recovery file contains the private key encrypted with AES-GCM. PBKDF2-SHA-256 derives its encryption key from a randomly generated recovery code. The file and code must be stored separately.
- Clearing browser data removes the local key and token. A recovery file and its code are needed to restore access on another device. Losing both means the account cannot be recovered by username alone.

## Read and cache strategy
- Public feed pages are unauthenticated and contain only public post/profile fields and aggregate like counts. No user's liked/saved state is included in CDN-cached responses.
- `/api/public/posts` serves keyset-paginated public pages (20 by default, server maximum 30). The Vercel route sets a 60-second shared cache with stale-while-revalidate. The Cloudflare Worker path uses Cache API with a 60-second edge TTL.
- Personal liked/saved state is requested separately in one batch for the current page, so one person's state is never cached for another user.
- The following feed and writes remain authenticated and are not shared-cacheable.
- IndexedDB stores recent feed pages per local account. Cached pages render immediately; the app refreshes on navigation, manual refresh, return to a visible tab after a long pause, or reconnect.
- Service Worker caches only the static app shell and same-origin assets. API responses and private state are not stored in the Service Worker cache.
- Pagination uses a composite cursor based on creation time and post ID (plus rank score for the popular feed); database indexes support those orders.

## Writes and abuse controls
- Post creation is limited to 12 posts per user per hour.
- Media upload accepts a maximum of four files per post, validates MIME types and size, and stores objects under the uploader's UUID prefix.
- Likes, follows, comments and bookmarks have server-side rate limits.
- Post edits/deletes are restricted to the authenticated author.
- Comment edits/deletes are restricted to the comment author; replies are limited to one level.
- Notifications are written server-side after likes, comments/replies and follows.
- RLS remains enabled on exposed public-schema tables. Browser writes are routed through the Edge Function; the service-role key is never exposed.

## Scale and limits
- CDN caching reduces repeated database reads of public pages. IndexedDB reduces repeat reads on the same device. Neither replaces PostgreSQL as the source of truth.
- A cache hit still consumes an inbound request at the CDN/Worker edge. A cache miss reaches the Vercel route or Cloudflare Worker and then Supabase.
- Supabase Free currently includes 500,000 Edge Function invocations/month, 500 MB database storage, 1 GB file storage and 5 GB egress. Cloudflare Workers Free currently includes 100,000 Worker requests/day and 10 ms CPU per invocation. Vercel Hobby includes 1 million function invocations/month, subject to its fair-use rules.
- These quotas are hard ceilings, not a concurrent-user guarantee. A busy social network will exceed free limits through posting, reactions, profile views, follows, comments and media egress before it can sustain 100,000 active users at meaningful engagement.
- No 100,000-user or 100,000-concurrent-user load test has been run. Do not make a capacity claim until staged load tests and usage monitoring support it.

## Explicit non-goals
- No direct messages.
- No user search or post search.
- No automatic paid upgrades, paid add-ons or billing changes.
- No claim that the free tier is unlimited.
