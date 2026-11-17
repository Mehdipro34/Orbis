# ORBIS project status

**Updated:** 2026-11-18  
**Development branch:** `nextjs-v2`  
**Production branch:** `main`  
**Production URL:** https://orbis-mehdipro34.vercel.app

## Release boundaries

The existing production application remains on `main`. The Next.js v2 work is isolated on `nextjs-v2`; production aliases have not been switched and no existing account or post has been migrated or deleted.

## Implemented in Next.js v2

- Next.js App Router foundation with strict TypeScript, Tailwind CSS 4 and ESLint.
- Server-side public feed adapter to the active Supabase Edge Function.
- `GET /api/posts`: validated latest/popular feed, cursor pagination, public-only short CDN cache and explicit upstream errors.
- `GET /api/health`: checks the active Supabase Edge Function health endpoint.
- Responsive dark/light UI with persisted theme choice.
- Public feed UI with latest/popular tabs, refresh, cursor pagination, loading, empty and error states.
- Registration and key-recovery UI using the existing P-256 device identity flow. The private key stays in browser storage; the signed guest session is held in an HttpOnly cookie. This is not password, email or Telegram authentication.
- Authenticated text-only post composer with input validation, character counter, submission state and server-confirmed feed refresh.
- Per-post like, bookmark and comment UI wired to the existing authenticated API. Comment threads support first-level comments and replies; reply lists load on demand.
- Authenticated personal-state lookup for liked and saved posts, fetched in batches from the existing API.
- Server Route Handlers proxy the social mutations to the existing Edge Function; the browser does not connect to PostgreSQL with service credentials.
- Zod schemas validate text posts (1–500 characters), comments (1–1000 characters), bookmark IDs, and unknown fields are rejected where strict schemas are used.
- Existing PWA source remains in the repository.

## Existing backend capabilities verified

The production Supabase project is healthy and the active `orbis-api` Edge Function is version 55. It contains routes for guest authentication, public posts, post creation and editing, likes, comments/replies, follows, profile reads/updates, bookmarks, media upload, stories, notifications, direct conversations/messages, ads and clans. The presence of backend routes does not mean all of these modules are implemented in the Next.js v2 interface.

The database currently contains 19 recorded migrations and the existing social tables, including profiles, posts, likes, follows, bookmarks, stories, comments, reports, conversations, messages, notifications and clans.

## Still not implemented in Next.js v2

- Full profile pages, edit profile and follow/unfollow screens.
- Media upload and media post composer; current v2 composer is text-only.
- Stories UI.
- Direct messages and conversation list.
- Notifications UI.
- Clan discovery, membership and ranking UI.
- Search, reposts, mentions, blocks and mutes.
- Admin panel, admin role management and moderation dashboard.
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

- The previous Next.js v2 CI run completed successfully: dependency install, lint, TypeScript check, tests and production build.
- The Vercel preview for commit `03bb93d` completed with state `READY`. This was before the latest post-interaction UI commits; a fresh preview and CI run are required to validate the new changes.
- The branch CI checks lint, TypeScript, Vitest, legacy static regression tests and production build.
- The v2 UI has not yet been tested in a real browser with a real account across registration, recovery, post creation, likes, comments, replies and bookmarks. API proxy modules are compiled but runtime integration still needs browser-level verification.
- No load test has been run. No claim is made that the current free-tier deployment supports 100,000 concurrent users.
- Supabase Edge Function v55 was inspected through the connector, but its Deno source has not been independently type-checked or load-tested in this stage.

## Next engineering stages

Complete a browser end-to-end test pass against the preview and active backend; add a committed lockfile; then implement profile/follow, media upload, stories, messages, notifications, clans and search incrementally. Review migration drift and security-advisor findings before any database schema change. Keep production isolated until a release review is complete.
