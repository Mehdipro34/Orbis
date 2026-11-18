# ORBIS project status

**Updated:** 2026-11-18  
**Development branch:** `nextjs-v2`  
**Production branch:** `main`  
**Production URL:** https://orbis-mehdipro34.vercel.app

## Release boundaries

The existing production application remains on `main`. The Next.js v2 work is isolated on `nextjs-v2`; the production alias has not been switched. The user explicitly requested a clean start, so the active Supabase project was cleared of all existing accounts and social records on 2026-11-18.


## Work completed on 2026-11-18

- Replaced the promotional home hero with a responsive social-first layout: left navigation, central timeline, right community panels and mobile bottom navigation.
- Kept the public feed accessible without authentication. The composer remains available only to signed-in users; guests are not forced onto the registration screen when opening the home route.
- Added automatic recovery of a saved P-256 device identity when the 30-day session cookie expires, unless the user explicitly signed out. Sign-out now clears the server session while retaining the local private key for easier return.
- Existing authenticated sessions visiting `/login` or `/register` are redirected to the home feed. The composer and personal feed state respond to session changes.
- Cleared all 56 existing profiles and the one linked Supabase Auth user. Verified zero rows in `auth.users`, `auth.identities`, `auth.sessions`, `auth.refresh_tokens`, `profiles`, `posts`, `post_likes`, `post_comments`, `follows`, `bookmarks`, `stories`, `notifications`, `messages`, `conversations`, `clans`, legacy ORBIS post/reaction/bookmark tables, reports, poll votes and ad tables. The database schema and server functions were preserved.
- `public.api_rate_limits` was preserved as infrastructure state. One 46,878-byte object still exists in the `orbis-media` Storage bucket without a social record; it was not removed via direct SQL because Storage object deletion must use the Storage API.
- Latest GitHub Actions run for commit `4ea05cee428d0783865337fde17d83ed09c6ea00` passed lint, TypeScript, unit/regression tests and the production build. Vercel preview deployment `dpl_AiLwCBhMkf9nVRvKRSFdiHF5WcJ3` reached `READY` at https://orbis-git-nextjs-v2-mehdipro34.vercel.app/.
- Production still points to `main`; no live alias cutover was made because real-browser E2E for registration, recovery, post creation and social actions has not yet been completed.

## External API integration status

The supplied integration brief lists Upstash Redis; ImgBB, Pexels, Pixabay and Unsplash; Klipy and Giphy; Cloudinary; TMDB and OMDb; RAWG and IGDB; TheSportsDB; NASA, NewsAPI and The Guardian; Turnstile; Sentry; and PostHog. These are requested providers, not verified active integrations.

- The current v2 `.env.example` contains only public Supabase URL and publishable-key settings.
- Vercel currently has no project environment variables configured. Repository searches found no configured ImgBB, Upstash, Cloudinary or TMDB keys/adapters.
- Supabase is the only confirmed connected backend in this branch. Other provider integrations remain `NEEDS API KEY / CONFIGURATION`; do not claim real image, video, GIF, search/news, sports or analytics integration until credentials are configured and real requests are tested.

## Implemented in Next.js v2

- Next.js App Router foundation with strict TypeScript, Tailwind CSS 4 and ESLint.
- Server-side public feed adapter to the active Supabase Edge Function.
- `GET /api/posts`: validated latest/popular feed, cursor pagination, public-only short CDN cache and explicit upstream errors.
- `GET /api/health`: checks the active Supabase Edge Function health endpoint.
- Responsive dark/light UI with persisted theme choice.
- Public feed UI with latest/popular tabs, refresh, cursor pagination, loading, empty and error states.
- Registration and key-recovery UI using the existing P-256 device identity flow. The private key stays in browser storage; the signed guest session is held in an HttpOnly cookie. This is not password, email or Telegram authentication.
- Authenticated post composer supports text and up to four JPEG/PNG/WebP photos, with file count/type/size checks and server-confirmed feed refresh. The Next.js proxy caps the aggregate upload at 4 MiB to stay within serverless request limits.
- Per-post like, bookmark and comment UI wired to the existing authenticated API. Comment threads support first-level comments and replies; reply lists load on demand.
- Authenticated personal-state lookup for liked and saved posts, fetched in batches from the existing API.
- User profile pages with authenticated profile reads, follower/following counts, follow/unfollow, and self-service display-name/bio editing through validated server routes.
- Notifications inbox with unread count, single/all read operations, and actor profile links.
- Clan discovery, creation, joining and leaving using the backend's one-clan-per-user rule; owner leave is blocked by the current backend contract.
- Private bookmarks library with saved post cards and server-confirmed removal.
- Per-post reporting form and authenticated report adapter; reports are saved to the existing reports table.
- Server Route Handlers proxy social mutations and multipart image uploads to the existing Edge Function; the browser does not connect to PostgreSQL or storage with service credentials.
- Zod schemas validate text posts, uploaded media metadata, comments (1–1000 characters), profile updates, clan creation, report reasons and bookmark IDs; unknown fields are rejected where strict schemas are used.
- Existing PWA source remains in the repository.

## Existing backend capabilities verified

The production Supabase project is healthy and the active `orbis-api` Edge Function is version 55. It contains routes for guest authentication, public posts, post creation and editing, likes, comments/replies, follows, profile reads/updates, bookmarks, media upload, stories, notifications, direct conversations/messages, ads and clans. The presence of backend routes does not mean all of these modules are implemented in the Next.js v2 interface.

The database currently contains 19 recorded migrations and the existing social tables, including profiles, posts, likes, follows, bookmarks, stories, comments, reports, conversations, messages, notifications and clans.

## Still not implemented in Next.js v2

- Profile photo upload and a dedicated account settings screen.
- Stories UI and story media upload.
- Direct messages and conversation list (held until block/report controls and privacy safeguards are in place).
- Clan ranking based on the product's full planned scoring formula.
- Search, reposts, mentions, blocks and mutes.
- Admin panel, admin role management and moderation dashboard. User reports are recorded, but there is no moderator queue or automated review in this version.
- Password/email/Telegram auth migration. The current P-256 identity/recovery flow is intentionally preserved to avoid locking out existing accounts.
- Scheduled cleanup and additional operational monitoring.

## Dependencies and reproducibility

Direct dependency versions are pinned (Next.js 16.4.6, React 19.3.1, TypeScript 5.9.3, Zod 4.6.7, Vitest 5.1.0, ESLint 9.39.5). A committed npm lockfile is still required for fully reproducible installs.

## Database and security boundaries

- No Supabase schema changes were made in this stage; no migration was applied.
- The live database has 19 recorded migration entries, while the repository's checked-in SQL migration set is not a complete, verified mirror. Reconstruct the baseline before introducing DDL.
- Service-role credentials and guest HMAC secrets must remain server-side and are not included in the browser bundle.
- Supabase security advisors reported 15 informational RLS-enabled-without-policy findings and one warning for disabled leaked-password protection. Some no-policy tables may be service-role-only, but each finding still requires an access-model review.
- Performance advisors reported six foreign-key indexes missing and 23 unused indexes. Unused indexes must not be removed based on an early/short observation window alone.
- Vercel production remains on `main`; Cloudflare deployment is not configured and is not assumed active.

## Verification status

- Latest full GitHub Actions verification for the current preview head passed: lint, TypeScript, unit/regression tests and production build.
- The branch CI checks lint, TypeScript, Vitest, legacy static regression tests and production build.
- Profile, follow, like, bookmark, comments, notifications, clan, report and media-upload adapters have unit tests. The latest full-suite result must be checked against the latest branch head. The v2 UI has not yet been tested in a real browser with a real account; browser verification is still required for registration, recovery, publishing, uploads, social actions, profile updates, notifications and clan membership.
- No load test has been run. No claim is made that the current free-tier deployment supports 100,000 concurrent users.
- Supabase Edge Function v55 was inspected through the connector, but its Deno source has not been independently type-checked or load-tested in this stage.

## Next engineering stages

Complete a browser end-to-end test pass against the preview and active backend; add a committed lockfile; then implement stories, message safeguards and inbox, search, ranking and moderator tooling incrementally. Review migration drift and security-advisor findings before any database schema change. Keep production isolated until a release review is complete.
