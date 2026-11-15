# ORBIS — product and architecture specification

Status: implementation specification; deployment and scale claims remain unverified.

## Product definition

ORBIS is a Telegram-first social network. Its primary experience is a continuously refreshed post feed, a Stories stream containing only recent Stories, and a topic-based Navigator. Telegram is the only sign-in method. Do not add a general Search section unless product scope is explicitly changed.

Clients:
- Responsive website.
- Optional Telegram Mini App.
- Later Android and iOS clients using the same APIs and account model.

Telegram is the only identity provider and is also an optional internal archive destination. Users must open ORBIS from the official Telegram Mini App to register or sign in.

## Core experience

### 1. Main post feed
- One central feed, continuously refreshed.
- Feed can mix recent and older eligible posts; it must not be limited to only the newest items.
- The feed service chooses and orders posts server-side; the client receives cursor-based pages.
- A post card displays, in order: author/profile label, post title, topic, post body, then actions.
- Owner-authored posts show the owner as **Admin**.
- The feed must not pretend demo/sample posts are real user posts.

### 2. Stories
- A separate Stories stream.
- Show only currently recent/active Stories; expired Stories are excluded.
- Target platform-wide intake ceiling: up to 100,000 new Stories per day.
- Per-account target: at most one Story publication per day.
- Expiration and daily quota must be enforced server-side, not only in the browser.

### 3. Navigator
- A distinct topic discovery area, divided into topic-specific streams.
- Each topic stream has its own independently deployable Navigator service boundary.
- Topic streams refresh continuously and may include editorial/news items where the source and attribution are clear.
- No general-purpose Search feature.
- Navigator components must be independently deployable and independently observable; do not claim that a separate deployment automatically guarantees separate physical capacity.

### 4. Minimal profile
Only show:
- Display name
- Chosen unique username
- Short description
- Owner's posts
The profile is intentionally minimal. Do not add follower counts, profile galleries, biography sections, or other fields without approval.

### 5. Registration
- ORBIS accounts, independent of Telegram and Google sign-in.
- User enters a Gmail address as plain account information; no email is sent and no verification is performed in the agreed first version.
- User chooses password, display name, and unique username.
- Username uniqueness must be enforced atomically by the backend.
- Never store plaintext passwords. Use a modern password hashing scheme and secure session handling.
- Because the email is unverified, do not present it as proof of ownership or promise email-based account recovery.

### 6. Publishing limits and capacity targets
- Per account: maximum one post per day and one Story per day.
- Platform-wide target: up to 100,000 posts per day and up to 100,000 Stories per day.
- These are product targets, not verified capacity guarantees. Enforce quotas centrally and load-test before claiming support.
- Older posts remain eligible for the main feed; Stories are time-limited/recent only.

## Service boundaries

Initial independently deployable logical services:
1. Edge/API Gateway
2. Auth and sessions
3. Username reservation
4. Minimal Profile
5. Posts write/API
6. Posts Navigator/feed assembly
7. Stories write/API
8. Stories Navigator
9. Topic Registry / Hashtag Names
10. Topic Feed / Topic Navigator (one independently deployable instance per topic group as traffic requires)
11. Interests / topic preferences
12. Notifications
13. Moderation and abuse controls
14. Telegram Storage Manager
15. Referrals / access rules (only after exact rules are approved)
16. Monitoring, health checks and failover coordination

The user previously emphasized separate Navigator services. Preserve independent deployment boundaries for each Navigator/topic stream. Do not invent a fixed number of physical servers: Workers are deployments, not dedicated machines, and free-tier quotas may be shared at account level.

## Storage

Telegram private channels are the intended archive for post and Story payloads/media. Storage Manager assigns storage shards and records references.

A queryable metadata index is still required for:
- account IDs and username uniqueness
- post/story IDs, author IDs, timestamps and expiry
- topic assignments and feed cursors
- Telegram channel/message/file references
- moderation state and quota counters

Telegram channels are not a database and cannot efficiently replace an index. Keep credentials, password hashes, sessions and security-critical state in a proper database/security store, not as publicly readable channel messages. Never expose bot tokens or channel identifiers to clients.

## Explicitly excluded for now
- General Search.
- Reels/short-video section (not part of the clarified core scope).
- Complex public profiles and follower-centric profile UI.
- Mandatory Telegram login.
- Email confirmation or sending registration emails.
- Any claim of guaranteed 100,000 concurrent users or million-user scale before testing.

## Scale and reliability plan

- Stateless request handlers where possible.
- Cursor pagination; bounded response sizes.
- Queue-based asynchronous media/archive work.
- Caching for hot topic/feed metadata.
- Sharded Telegram archives with retry and dead-letter handling.
- Idempotent writes and server-side per-user/day quotas.
- Independent health checks and circuit breakers between services.
- Load tests for realistic request mix, media sizes, feed refresh rates and failure scenarios.
- Publish measured throughput/latency and provider quotas; do not equate daily item volume with concurrent users.

## Current repository state (verified from files)

- Repository: https://github.com/Mehdipro34/Orbis
- Cloudflare Worker name: orbissocial
- `src/index.js`: health endpoint, protected setup route and minimal Telegram webhook only.
- `public/index.html`: visual prototype; no persistent post creation, Stories, real Navigator or real account system.
- `wrangler.toml`: static assets + Worker configuration.
- No verified working Telegram webhook, persistent metadata index, Telegram archive pipeline, account registration, or load-tested services.

## Build sequence

1. Replace the prototype navigation/design with the clarified three-part experience: Posts, Stories, Navigator; remove Search.
2. Define and create the metadata database schema and migrations.
3. Implement authentication, atomic username reservation and minimal profiles.
4. Implement Posts write path, one-post-per-day enforcement, Telegram archival and metadata indexing.
5. Implement main feed assembly with cursor pagination and recent/older mixing.
6. Implement Stories write path, one-Story-per-day enforcement, expiry and recent-only stream.
7. Implement topic registry and independent topic Navigator deployments.
8. Add moderation, notifications, monitoring, referral/ad rules only after their exact business rules and providers are confirmed.
9. Connect website and optional Telegram Mini App; later mobile clients.
10. Load-test and report measured limits before increasing launch audience.

## Decisions retained from the owner

- Zero mandatory budget is a strong requirement; warn before any paid dependency.
- Telegram is internal storage, not user authentication.
- Gmail is collected as text only in the initial registration flow; no email is sent.
- No general Search.
- Keep profile minimal.
- Separate backend deployment boundary for every Navigator.
- Maximum one post and one Story per account per day; target maximum 100,000 platform-wide per format per day.


## Current implementation status (2026-11-15)

The active implementation differs from the older proposal above in these ways:
- `public/index.html` contains the current responsive client, Telegram-only sign-in, Supabase API bridge, feed, profile, topic Navigator, bookmark UI, and text Stories UI.
- `orbis-telegram-auth` and `orbis-api` are deployed Supabase Edge Functions.
- Supabase currently has eight application tables and an `orbis-media` Storage bucket. The profiles/posts/Stories tables were empty at the last inspection; no real user content should be implied.
- The Cloudflare Worker is retained for static assets and RSS/news only. Its legacy KV-based auth and social API routes are disabled to avoid two competing account stores.
- The orbital intro is a client-side animation (canvas starfield, ORBIS planet, orbital stations, shuttles, asteroid belt and meteor trails); reduced-motion preferences are respected.
- Production use still requires the owner to configure the Telegram bot token secret, the official bot Mini App URL and the HTTPS deployment, then complete end-to-end testing.
- No claim of production readiness, unlimited free capacity, or 10,000+ concurrent users is made without tests.
