# ORBIS — News Universe Architecture

Status: news-only responsive PWA. No user-authored posts, comments, replies, stories, public profile pages, DMs, clans, or user media publishing.

## Product
- **For You:** cross-topic feed from a rotating sample of the 15 category catalogs. Interest preferences and liked categories rank relevant stories higher without hiding the other categories.
- **Latest:** cross-topic feed sorted by publication time.
- **Category feeds:** 15 topics: World, Politics, Business, Technology, Science, Movies & Series, Culture, Gaming, Sports, Auto, Health, Education, Environment, Travel, Food.
- **Navigator:** search the 568-entry RSS catalog by source, category, country or language metadata. A source can be opened directly.
- **Media:** RSS image/thumbnail/enclosure extraction; direct video enclosure and YouTube video links when present. Topic-art fallback is used when the publisher has not provided a photo.
- **Translation:** per-card title and summary translation to a reader-selected language. Translation results are cached in local storage. Translation is third-party, best-effort, and not certified.
- **Encyclopedia:** Wikipedia API search in the selected language. Search result excerpts and thumbnails are linked to the original Wikipedia page.
- **Saved:** IndexedDB stores explicitly saved articles. Image blobs are saved only when browser cross-origin access succeeds and image size is within the local limit. The saved cache is per browser/device.
- **Feed cache:** last 160 article records are stored in IndexedDB for offline reading.
- **Refresh:** manual and 10-minute foreground refresh, with 10-minute CDN caching for RSS.
- **Pagination:** first 24 feed cards render, then the user can load more in batches to avoid rendering every card at once.

## RSS data and ingestion
- `api/news/catalog.js` contains 568 unique feed URLs across international publisher sources and selected topic feeds; source records include category, country, source-language metadata, publisher label, and host.
- `api/news/sources.js` exposes the full directory.
- `api/news.js` rotates through bounded feed batches. All-topics feed selects a small rotating sample across all 15 categories (up to 30 publishers); a category feed selects up to 12 feeds; a specific source query selects exactly one.
- Feed requests use timeouts and `Promise.allSettled`, deduplicate article URLs, sort by publication date and cap the response size.
- RSS headlines and short excerpts are shown with original-publisher links. Full third-party articles are not republished.
- RSS media is displayed only when supplied by the feed. For items without media, the UI displays a category-themed graphic card.
- Some feed URLs may be inactive, redirect, become rate-limited or change. Country and language fields are source-level catalogue metadata and are approximate, not guaranteed article-language detection.
- Rule-based headline screening is imperfect and is not a full editorial or AI moderation system.

## Anonymous identity and reactions
- The browser stores a random device UUID and signed guest token; these are not presented as a public profile.
- Supabase Edge Function validates the token.
- `news_reactions` stores an article URL hash, anonymous device user ID, and timestamp. Primary key `(article_key,user_id)` enforces one active reaction per device/article.
- Likes update the recommendation weight locally, then synchronize through the Edge Function. Offline reactions queue for later sync.

## Translation and encyclopedia
- `api/translate.js` validates target languages and bounds text length/batch size before calling an external translation endpoint.
- `api/wiki.js` queries Wikipedia's API and returns article title, short extract, thumbnail and original URL.
- Translation and Wikipedia availability depend on external provider availability; the original publisher link remains available.

## Advertising
- Web feed requests an approved ORBIS Ad Center campaign and inserts a card after every five articles.
- Impressions are recorded when the card becomes visible; clicks are recorded at its destination.
- If there is no approved campaign, the UI clearly labels the empty advertising placement rather than pretending an external ad is live.
- The supplied AdMob Android IDs are recorded in `config/admob.json`. A web/PWA cannot render a mobile SDK AdMob unit. Real AdMob requires a native Android client with the Google Mobile Ads SDK and privacy/consent implementation.

## Offline and PWA
- Service worker caches the static app shell and manifest.
- IndexedDB stores last-feed metadata and explicit article saves.
- The app attempts to cache an article's image blob when cross-origin access allows it; image/video availability offline is not guaranteed.
- RSS refresh, translation, Wikipedia, advertising, publisher links and reaction synchronization need a connection.

## Reliability and capacity
- Feed aggregation is bounded: at most 30 sources for all-topic requests and 12 for a topic request.
- RSS directory size is not the same as simultaneous upstream load. A request only checks a rotating subset.
- No load test or complete multi-device end-to-end test has been completed. Do not promise a concurrent-user figure. Vercel/Supabase free-tier limits, database load, egress, function runtime, publisher rate limiting and external translation limits must be monitored before scaling.
