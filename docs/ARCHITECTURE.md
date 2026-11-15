# ORBIS — current product and technical architecture

Status: active web/PWA implementation. The production app opens directly in guest mode; there is no registration form, email login, password login or Telegram login in the web client. Deployments and API health have been checked, but a full browser end-to-end and load test have not been completed.

## Product

ORBIS is an all-ages-oriented social network with a dark orbital identity. Visitors enter immediately and receive a device-bound guest profile. Each profile has a stable sequential public number; each post has its own sequential post number.

## Current user-facing features

- **Guest identity:** the browser creates a UUID in local storage. The API creates or loads the matching profile and issues a signed HMAC guest token. No email, password or Telegram account is required. Clearing browser storage or switching devices creates a new identity; there is no recovery path without an account.
- **Profiles:** unique username, display name, bio, public ORBIS number and posts.
- **Posts:** text, up to four photos/videos, topics, post replies and polls with 2–6 options and a 24-hour default duration. Each post receives a unique public number. Creation is rate-limited to 12 posts per guest per hour; the former one-post-per-day index has been removed.
- **Feed:** 20-item server pages with keyset/cursor pagination. “For you” sorts by a database-maintained engagement score; “Following” filters to followed authors; “Fresh” is chronological. Topic filters use indexed query paths.
- **Engagement:** likes, poll votes, post replies, follows, bookmarks, shares and reports. Poll votes are stored separately and one vote per guest per poll is enforced by a primary key.
- **Stories:** text or one photo/video; stories expire after 24 hours.
- **Navigator:** topic discovery plus 16 attributed RSS sources spanning general news, technology, science and space. RSS headlines link to the original publisher. A conservative text filter removes some adult, sexual, graphic-violence and drug-related headlines for the all-ages goal; it is not a perfect editorial review.
- **Advertising:** the Ad Center stores campaigns for review. Only campaigns marked approved are eligible for feed placements. Feed cards are labelled “РЕКЛАМА”; view and click events are recorded. The owner's AdMob Android App ID and three ad-unit IDs are retained in `config/admob.json`, and the publisher record is in `public/app-ads.txt`. These mobile AdMob IDs do not display ads in the current web app; native Android SDK integration is separate.
- **Messaging, notifications and clans:** existing one-to-one messages, notification center and one-clan-per-guest features remain in the app.
- **PWA:** browser-installable app shell; social actions require internet access.

## Architecture

### Client and API
- `public/index.html` is the responsive web/PWA client.
- Guest identity is stored locally as a device UUID; the browser holds a signed guest token, never a Supabase service-role key.
- API calls go to the Supabase Edge Function `orbis-api`. The function validates guest tokens using HMAC and applies database-backed rate limits.
- RSS is served through Vercel serverless routes in `api/news.js`; source metadata is exposed through `api/news/sources.js`.

### Supabase
- PostgreSQL is the canonical store for profiles, posts and social metadata.
- Supabase Storage bucket `orbis-media` stores post and Story media.
- The Edge Function uses a server-side service key; it does not create Supabase Auth accounts for guests.
- `public_number` and `post_number` are sequence-backed unique numbers.
- `engagement_score` is maintained by database triggers when likes and post replies are added or removed.
- `post_poll_votes` stores one vote per guest/post. `post_poll_counts` aggregates results.
- Cursor, topic, ranked-feed, ad-campaign and ad-event indexes support the intended query paths.
- The legacy `account_lookup` table remains from an earlier account-based design and is not used by the guest-only web client.
- RLS remains enabled. Tables without browser policies are accessed only by the server-side Edge Function; do not add broad public policies to silence linter notices.

### Vercel
- Vercel serves the static app from `public/` and the RSS routes from `api/`.
- Production deploys are connected to GitHub `main`.

## Capacity and reliability

- Feed requests use keyset pagination rather than deep SQL offsets.
- Common feed paths have dedicated indexes. The “For you” ranking uses a stored engagement score rather than calculating a full ranking in the browser.
- RSS responses use CDN caching with stale-while-revalidate.
- Guest creation, feed reads, media, posts, likes, poll votes and ad events have server-side rate limits.
- Media limits are checked on the server: photos up to 12 MB, videos up to 50 MB, up to four per post.
- No load test has been run. There is no verified concurrent-user capacity or guarantee of 10,000/100,000 users. Supabase and Vercel free tiers have quotas and can throttle or pause services. Measure latency, database load, storage egress, error rates and provider limits before scaling.

## All-ages safeguards and known limitations

- Text submissions and ad copy receive basic rule-based checks; RSS headlines receive a separate conservative filter.
- Users can report posts. This is not a complete AI moderation system or a staffed moderation operation.
- Uploaded images and videos are validated for type and size, but are not automatically understood by a visual moderation model. Human review and a proper moderation workflow are still needed before a broad all-ages public launch.
- RSS filters are imperfect and can hide legitimate reporting or miss unsuitable material.
- Guest identity is device-bound and cannot be recovered after local browser data is lost.
- AdMob IDs are configured for a future native Android build, not active on the current website.

## Verification status

- Production HTML contains the guest-only client, feed tabs, polls, ad card renderer and expanded RSS source list.
- Vercel production deployment and `/api/health` returned READY / HTTP 200 during the latest check.
- Supabase Edge Function `orbis-api` deployed successfully (active version 41 at the latest check).
- New RSS feeds were tested live; the tested 12 new sources returned HTTP 200 and between 10 and 30 items before the all-ages filter.
- Database indexes, public-number uniqueness and ranked-feed indexes were checked.
- These checks do not replace a real multi-browser test of posting, voting, following, ad event recording and media upload, or a load test.
