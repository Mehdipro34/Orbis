# ORBIS — News Universe Architecture

Status: news-only responsive PWA. There are no user-authored posts, comments, replies, stories, public profile pages, DMs, clans, or user media publishing.

## Product
- **For You:** category preference weights are stored on device. A reader chooses interests; a like increases the category weight. Personalized ranking orders selected/high-weight categories first and uses publication time as a recency signal.
- **Latest:** combines all seven categories and sorts by publication time.
- **Topic streams:** World, Technology, Science, Movies, Gaming, Business, Auto.
- **Navigator:** ready-made topic catalog and RSS source directory.
- **Saved cache:** explicitly saved article title, excerpt, publisher, URL, date, category and optional publisher image are stored in IndexedDB. Cache is browser/device-local, not cloud-synced.
- **Reactions:** a device can like/unlike each article. SHA-256 of the canonical article URL is used as article key; article body is not stored in the reaction table.
- **Refresh:** manual and a 10-minute foreground timer; RSS CDN cache is 10 minutes with stale-while-revalidate and stale-if-error.

## RSS ingestion
- `api/news.js` selects up to five feeds per category and fetches them concurrently with a short timeout.
- `api/news/sources.js` exposes the source and category directory.
- Entries are deduplicated, date-sorted and capped. Publisher links must use HTTPS and match an allowed source host. Image links are included only when host matches the publisher allowlist.
- Rule-based headline/summary screening removes some unsuitable terms. It is imperfect, can hide valid journalism or miss unsuitable content; this is not human editorial review or an AI moderation service.
- ORBIS shows headline/summary snippets and links to the publisher; it does not republish full articles.

## Anonymous identity and server API
- Browser stores a random device UUID and signed guest token; these are not presented as a registration or public profile.
- Supabase Edge Function validates the signed token.
- `news_reactions` stores `article_key`, anonymous device `user_id` and timestamp. Primary key `(article_key,user_id)` enforces one active like per device/article.
- `news_reaction_counts` aggregates reaction totals. Only service-role Edge Function access is granted; RLS is enabled and browser roles receive no table privileges.
- Legacy social mutation and read endpoints return HTTP 410. Historical legacy records may remain in the database, but the current client exposes no social posting features.

## Advertising
- Web feed requests an approved campaign from ORBIS Ad Center and places a native-style card after every five news cards.
- Only approved campaigns are served; impressions are tracked when a card becomes visible and clicks when the destination is opened.
- If no approved campaign exists, a clearly labelled ad placement is shown, not represented as a live external ad.
- Android AdMob App ID and supplied Feed Native Ad Unit ID are recorded in `config/admob.json`. A mobile AdMob unit does not render in a regular website/PWA. Real AdMob impressions require a native Android client with Google Mobile Ads SDK plus appropriate app/privacy/consent setup.

## Offline and PWA
- Service worker caches the static app shell and manifest.
- IndexedDB holds only articles explicitly saved by the reader. Saved page reads from IndexedDB without internet.
- Reactions update optimistically and queue for server synchronization when connectivity returns.
- Live RSS, ads, reactions sync and publisher links need internet.

## Reliability and capacity
- RSS requests are bounded per category, time-limited and CDN-cached.
- PWA shell and saved text/metadata are available offline. External images are not guaranteed offline unless separately cached by the browser.
- No load test or multi-device E2E test has been completed. Do not promise a concurrent-user figure. Free-tier Vercel/Supabase limits, database load, egress, function limits and publisher throttling must be monitored before scaling.
