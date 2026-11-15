# ORBIS — News Universe

ORBIS is a news-first social reading PWA. There are no user-authored posts, public profiles, stories, comments, or direct messages. Readers can like news and save it privately to their device for offline reading.

## Production
- Website/PWA: https://orbis-mehdipro34.vercel.app
- Frontend: `public/index.html`
- RSS aggregator: `api/news.js`
- RSS directory: `api/news/sources.js`
- Anonymous reaction API: Supabase Edge Function `orbis-api`
- Supabase project: `wdwvcvpgovvkoodozbxf`

## Features
- Seven topic streams: World, Technology, Science, Movies, Gaming, Business and Auto.
- For You: readers choose interests; likes add category weight and reorder the personalized stream.
- Latest: a cross-category chronological stream.
- Navigator: topic catalog and publisher/source directory.
- Article actions: like/unlike and open the original publisher. No user comments, replies or posting.
- Offline reading: explicitly saved news is stored in IndexedDB with a local fallback.
- Refresh: manual and automatic every 10 minutes while the app is in use. RSS CDN cache is 10 minutes.
- Native-style ad placement after every five articles. Approved ORBIS Ad Center campaigns show in the web feed and record impression/click events.
- Installable PWA shell.

## RSS directory
The source directory has 41 entries across seven categories: BBC News, Oxu.az, Deutsche Welle, Euronews, Al Jazeera, The Guardian, NPR, TechCrunch, The Verge, WIRED, Ars Technica, ScienceDaily, NASA, Phys.org, Nature, Variety, IndieWire, Deadline, The Hollywood Reporter, IGN, PC Gamer, Eurogamer, GameSpot, Kotaku, Game Developer, CNBC, BBC Business, The Economist, MarketWatch, Financial Times, Motor1, Electrek, InsideEVs and Autoblog.

Each category aggregates up to five feeds per request, removes duplicate article URLs, validates publisher-host links, and filters some unsuitable headlines/snippets. This is a rule-based filter, not full editorial or AI moderation. Publishers may change/block RSS endpoints; the interface reports partial failures. ORBIS shows short RSS excerpts and links back to publishers; it does not republish entire articles.

## Identity and privacy
No signup form and no public user profile are shown. A device-scoped anonymous identifier and signed token are used only for server-side reaction accounting and rate limits. Saved articles, selected interests, and recommendation weights stay in the browser. Clearing browser storage removes local preferences and the local saved cache.

## Advertising / AdMob
- Supplied Android App ID: `ca-app-pub-9946397950500083~3195122396`.
- Selected news-feed Native Ad Unit ID: `ca-app-pub-9946397950500083/7255776003`.
- The AdMob unit is recorded in `config/admob.json` for a future native Android client. AdMob mobile SDK IDs do not render ads in a standard website/PWA. Actual AdMob delivery requires an Android native client using Google's Mobile Ads SDK and the required privacy/consent setup.
- The current website uses approved ORBIS Ad Center campaigns. If none is approved, the feed shows a clearly labelled ad placement, not a fabricated third-party ad.

## Performance and limitations
- RSS requests are bounded per category, concurrent and time-limited. Responses use CDN caching and stale serving.
- Saved articles are stored per browser/device, not synchronized across devices. Live news, ad retrieval and reaction synchronization need connectivity.
- No load test or multi-device end-to-end test has been completed. There is no verified 10,000/100,000 concurrent-user capacity. Free-tier Vercel/Supabase limits, RSS publisher limits, function execution and bandwidth quotas still apply.
- A native Android AdMob integration and testing remain separate release work.

## Main files
- `public/index.html` — news PWA, layout, feed and interactions.
- `public/sw.js` — static app-shell offline cache.
- `public/manifest.webmanifest` — install metadata.
- `api/news.js` — RSS aggregation and headline safety filter.
- `api/news/sources.js` — feed/category directory.
- `supabase/functions/orbis-api/index.ts` — guest session and news reactions.
- `config/admob.json` — supplied Android AdMob configuration.
- `docs/ARCHITECTURE.md` — technical architecture and known limits.
