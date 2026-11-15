# ORBIS

ORBIS is a guest-first social network with a dark orbital visual identity and an installable PWA interface.

## Production

- URL: https://orbis-mehdipro34.vercel.app
- Vercel production is connected to GitHub `main`.
- Supabase project: `wdwvcvpgovvkoodozbxf`.
- Edge Function: `orbis-api`.

## No-account access

- The site opens directly in guest mode.
- No registration, email, password or Telegram login is required.
- Each browser receives a persistent device UUID and a signed guest session.
- Each guest profile receives a unique sequential ORBIS number.
- Each post receives its own unique sequential post number.
- Clearing browser data or changing devices creates a new guest identity. Guest profiles cannot be recovered without a separate account/recovery mechanism.

## Social features

- “For you”, “Following” and “Fresh” feed modes.
- Cursor-based feed pagination and topic filters.
- Text, photo and video posts, post replies and 2–6 option polls.
- Likes, bookmarks, follows, sharing and reports.
- 24-hour Stories.
- Topic Navigator with 16 RSS news sources.
- One-to-one messages, notifications and clans.
- Ad Center campaigns with review status, feed placements, impression and click tracking.
- Installable PWA shell.

## Performance design

- Keyset/cursor pagination avoids deep SQL offsets.
- Indexed chronological, topic and engagement-ranked feed paths.
- Engagement scores are maintained by database triggers.
- RSS responses use CDN caching.
- Server-side rate limits protect guest sessions and high-frequency actions.
- This design improves query efficiency but does not establish a concurrent-user capacity. No load test has been completed.

## Ads

- Owner-supplied AdMob Android App ID and ad-unit IDs are in `config/admob.json`.
- Publisher record is in `public/app-ads.txt`.
- AdMob mobile IDs cannot directly display ads on the current web client. The live web feed supports approved ORBIS Ad Center campaigns; campaigns must be approved before they appear.
- Ad content is labelled in the feed and impression/click events are recorded.

## All-ages safeguards

- Basic rule-based checks apply to text posts and ad copy.
- RSS headlines use a conservative all-ages keyword filter.
- Reports are available.
- Image/video uploads are type/size checked but do not yet have automated visual content moderation. The product is not yet a fully moderated all-ages platform.

## Media

- Supabase Storage bucket: `orbis-media`.
- Photos: JPEG, PNG, WebP or GIF, up to 12 MB each.
- Videos: MP4 or WebM, up to 50 MB each.
- Up to four media files per post.

## Repository structure

- `public/index.html` — responsive web app client.
- `public/orbis-social.js` — messages, notifications and clans UI.
- `public/sw.js`, `public/manifest.webmanifest`, `public/orbis-icon.svg` — PWA.
- `api/news.js` — RSS/news endpoint.
- `api/news/sources.js` — RSS source directory.
- `supabase/functions/orbis-api/index.ts` — guest sessions and social API.
- `config/admob.json` — owner-supplied future Android AdMob configuration.
- `docs/ARCHITECTURE.md` — architecture and known limitations.

## Verification

Latest checks confirmed a READY Vercel production deployment, HTTP 200 API health, active Supabase Edge Function, 16 RSS sources, and database indexes for unique public numbers and feed pagination/ranking. The new RSS feeds returned HTTP 200 in live checks.

A full browser end-to-end test across multiple devices and a load test have not been completed. Free-tier provider limits still apply; do not assume unlimited traffic or a specific concurrent-user count.
