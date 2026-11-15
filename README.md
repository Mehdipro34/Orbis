# ORBIS — News Universe

ORBIS is a news-first social reading PWA. It has no user-authored posts, public profiles, comments, stories or direct messages. Readers can like articles, tune a personal feed, translate summaries, and save stories privately for offline reading.

## Production
- Website/PWA: https://orbis-mehdipro34.vercel.app
- Frontend: `public/index.html`
- RSS aggregator: `api/news.js`
- RSS catalog endpoint: `api/news/sources.js`
- RSS catalogue data: `api/news/catalog.js`
- Wikipedia search endpoint: `api/wiki.js`
- Translation endpoint: `api/translate.js`
- Anonymous reaction API: Supabase Edge Function `orbis-api`

## Product features
- **568 RSS feed URLs across 151 unique host domains** from international publishers plus additional curated feeds. These are feed URLs, not 568 separate publisher companies; one publisher can expose many topic feeds. URLs are catalogued by topic, country, and an approximate source-language label. A URL in the catalogue does not guarantee that the publisher currently serves it.
- **15 topic catalogs:** World, Politics, Business, Technology, Science, Movies & Series, Culture, Gaming, Sports, Auto, Health, Education, Environment, Travel, Food.
- **For You:** all topics are present. Chosen interests and liked categories affect ranking; the app does not hide all other topics.
- **Latest:** cross-category chronological feed.
- **Navigator:** filter and open countries, categories, and individual publisher RSS feeds. The complete source directory is searchable.
- **Media cards:** show RSS-supplied images, video enclosure links, or YouTube video references where the publisher provides them. When there is no source image, ORBIS displays a topic-themed graphic cover rather than inventing a photo.
- **Translation:** choose from 62 target languages in settings. Auto-translation is enabled by default for the first eight visible cards when a feed opens; further cards can be translated on demand. Each card can toggle back to its original text. Results are cached on the device. The translation provider is an external best-effort service and can temporarily fail or change.
- **Encyclopedia:** search Wikipedia in the selected language and save relevant entries.
- **Article actions:** like/unlike and save; no user comments, replies or posting.
- **Offline:** the latest feed metadata is kept in IndexedDB; saved articles are kept in a separate IndexedDB store. The app attempts to save the image with an article when the image host allows cross-origin access. Text/metadata is the reliable offline part.
- **Refresh:** manual and automatic every 10 minutes while the app is active. RSS API responses are CDN-cached for 10 minutes.
- **Advertising:** native-style placement after every five articles. Approved ORBIS Ad Center campaigns render in the website and record impressions/clicks. If there is no approved campaign, a clearly-labelled empty advertising slot is shown.
- **PWA:** installable to a supported desktop or mobile home screen.

## RSS aggregation
The aggregator does not request all 568 feeds simultaneously. A request rotates through bounded batches (up to 30 feeds for the all-topics feed, up to 12 for a single category, or one when a specific source is selected). This keeps the endpoint bounded and varies publishers over time. It deduplicates URLs, sorts by publication date, extracts available media, and keeps a short RSS excerpt with a link to the original publisher.

RSS sources can be retired, rate-limited, blocked, or changed by their publishers. Country and language labels are catalogue metadata and may not describe every individual article perfectly. Some feeds expose no images or video. ORBIS cannot guarantee every catalogue URL returns news at every moment. It does not republish full publisher articles.

Some headline/summary screening is rule-based. It is imperfect, can hide valid stories or miss unsuitable content; it is not human editorial review or complete AI moderation.

## Identity and privacy
No signup form and no public user profile are presented. A device-scoped anonymous identifier and signed token are used for reaction accounting and rate limits. Likes can be queued locally when offline. Interests, translation preferences, weights and saved stories are browser/device-local and do not sync across devices.

## Advertising / AdMob
- Supplied Android App ID: `ca-app-pub-9946397950500083~3195122396`.
- Selected feed Native Ad Unit ID: `ca-app-pub-9946397950500083/7255776003`.
- AdMob mobile SDK IDs do not render in a standard website/PWA. Actual AdMob delivery requires a native Android client using Google's Mobile Ads SDK and its privacy/consent setup.
- The current website uses approved ORBIS Ad Center campaigns.

## Performance and limitations
- The public RSS directory is large, but each feed request uses a bounded source batch.
- No load test or complete multi-device end-to-end test has been completed. There is no verified concurrent-user capacity.
- Vercel/Supabase quotas, publisher rate limits, network egress and translation provider policies still apply.
- Translation depends on an external service and is not a guarantee of certified translation.
- Offline text/metadata is available from IndexedDB; external video playback and most publisher images still need a network connection.

## Main files
- `public/index.html` — application UI and interactions.
- `public/sw.js` / `public/manifest.webmanifest` — PWA shell and installation metadata.
- `api/news/catalog.js` — RSS URLs, categories, countries and language metadata.
- `api/news.js` — RSS aggregator, feed media extraction and title screening.
- `api/news/sources.js` — full source directory API.
- `api/wiki.js` — Wikipedia search.
- `api/translate.js` — on-demand translation.
- `supabase/functions/orbis-api/index.ts` — anonymous reaction API.
