# ORBIS — current product and technical architecture

Status: active implementation. Email/password authentication is implemented with Supabase Auth and the social API is deployed; live email confirmation and end-to-end registration/posting are not yet verified.

## Product

ORBIS is an email-first social network with a cinematic orbital identity. Registration and sign-in use email + password; Telegram is not required. The main experience includes a live feed, profiles, topic Navigator, Stories, reactions, comments, post replies, bookmarks and follows.

## User-facing features in the current build

- **Account:** Supabase Auth handles email/password registration, email confirmation and persistent sessions. The API creates an ORBIS profile from verified account metadata on first authenticated visit.
- **Feed:** server-paginated posts, up to 20 per page, topic filters and refresh.
- **Posts:** title, topic, text, up to four media files, daily per-account publication quota.
- **Reactions:** likes stored separately and toggled by the signed-in user.
- **Comments:** separate `post_comments` table; 20 comments per request; owners can remove their own comments.
- **Post replies:** a reply is a separate post linked by `reply_to`, distinct from a short comment.
- **Profiles:** display name, username, short bio, own posts with author name and `@username` visible on each profile post, and follow/unfollow.
- **Stories:** text or one photo/video; visible only while unexpired; one Story per account per UTC day.
- **Bookmarks:** private per-user saved posts.
- **Navigator:** people/posts search, topic counts and attributed RSS headlines from the Worker.
- **Sharing:** post links use a post ID fragment; the client fetches the real post when a shared link is opened.
- **PWA:** browser-installable app shell; service worker caches static assets only. Social actions require an internet connection.

## Architecture

### Client
- `public/index.html` is the responsive web app client.
- The browser contains only the Supabase publishable key.
- The browser uses Supabase Auth email/password methods and sends its access token to `orbis-api`.
- API requests go directly to Supabase Edge Functions, not through a second Worker social API.

### Supabase
- PostgreSQL is the canonical store for profiles and social metadata.
- Supabase Auth stores the account and session.
- Supabase Storage bucket `orbis-media` stores post and Story media.
- Supabase Auth verifies credentials and issues a durable session; `orbis-api` creates the public profile from the authenticated user's signup metadata.
- Edge Function `orbis-api` verifies the Supabase session and serves social routes.
- The legacy `account_lookup` table is not used by the email-first frontend.
- `post_comments` and `api_rate_limits` are not directly accessible to browser roles.
- Aggregate views `post_like_counts`, `post_comment_counts`, and `post_topic_counts` avoid scanning every reaction/comment/post row when rendering feed counters.
- `consume_orbis_rate_limit` is a database-side atomic per-user rate limiter.

### Cloudflare
- Worker `orbissocial` serves static assets and RSS/news proxy endpoints only.
- `ORBIS_KV` is used for RSS cache and Worker news rate limiting.
- No R2 bucket is required. The current `wrangler.toml` and Worker source contain no R2 binding.
- A stale dashboard R2 binding named `ORBIS_MEDIA` caused the reported Cloudflare error 10085. Remove it from Worker Settings → Bindings before deploying again.

## Data model

Core tables:
- `profiles`
- `account_lookup`
- `posts`
- `post_likes`
- `post_comments`
- `follows`
- `bookmarks`
- `stories`
- `post_reports`
- `api_rate_limits`

RLS is enabled on all ten tables. Browser roles cannot read Telegram identifiers, account lookup mappings, comment rows or rate-limit rows directly. Security Advisor returned no findings at the latest inspection.

## Performance and abuse controls

- Feed pages are limited to 20 posts; comments to 20 per request; replies and profile posts are bounded.
- Search, media uploads, likes, comments, follows, bookmarks, reports and account creation and media uploads are guarded by Supabase Auth and server-side rate limits.
- Post and Story daily quotas are enforced by database unique indexes, not just UI code.
- Media type and size checks happen server-side.
- The Worker caches RSS responses; it does not proxy social API traffic.
- The performance advisor currently reports unused indexes. This is expected while the database has no real user traffic; do not remove indexes needed by the intended query patterns without measured evidence.

## Not implemented yet

- Direct messages.
- A notification center.
- Clans.
- Stars/Premium and paid packages.
- Advertising management and ad-reward flows.
- Full human moderation dashboard and proven AI moderation.
- Independent per-topic deployments and distributed queues.
- Production monitoring/alerting and load-tested failover.

Do not show these as available product features until they are actually implemented.

## Launch blockers

1. Owner must set `TELEGRAM_BOT_TOKEN` in Supabase Edge Function secrets for Mini App auth. For browser OIDC, also set `TELEGRAM_LOGIN_CLIENT_ID`, `TELEGRAM_LOGIN_CLIENT_SECRET` and the exact HTTPS `TELEGRAM_LOGIN_REDIRECT_URI` in Supabase Edge Function secrets; Cloudflare Worker secrets are separate.
2. Owner must set the official Telegram bot's Mini App URL to the deployed HTTPS Worker URL.
3. Owner must remove the stale Cloudflare `ORBIS_MEDIA` R2 binding from Worker Settings → Bindings.
4. Deploy the Worker and confirm the new build lists only `ASSETS` and `ORBIS_KV`.
5. Run real Telegram sign-in and the full post/comment/media/Story/logout smoke test.

## Capacity claims

The database was empty at the last inspection. No first live Telegram sign-in, full browser end-to-end test or load test has been completed. Free tiers have quotas and may pause or throttle. There is no verified guarantee of 10,000 or 100,000 concurrent users. Publish measured latency, throughput, error rates and provider limits before increasing launch traffic.
