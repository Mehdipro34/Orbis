# ORBIS project status

**Updated:** 2026-11-17  
**Development branch:** nextjs-v2  
**Production branch:** main  
**Current production URL:** https://orbis-mehdipro34.vercel.app

## Release boundaries

The existing production application remains the static PWA on main. The Next.js implementation is developed on nextjs-v2. No production alias has been switched, and no existing account or post has been migrated or deleted.

## Implemented in nextjs-v2

- Next.js App Router foundation with strict TypeScript settings.
- Tailwind CSS 4 PostCSS integration.
- ESLint flat configuration using Next.js 16 rules.
- Vitest tests for feed query validation and backend response handling.
- Shared security headers and a Content Security Policy.
- Server-side public-feed adapter to the existing Supabase Edge Function.
- GET /api/posts with validation, public-only 60-second CDN caching, cursor pagination and explicit error handling.
- GET /api/health checks the Supabase Edge Function health endpoint.
- Responsive dark/light UI and a persisted theme toggle synchronized through React's external-store API.
- Public feed UI with latest/popular tabs, refresh, cursor pagination, loading, empty and error states.
- Authenticated text-post creation through `POST /api/posts`, reusing the existing P-256 guest session in an HttpOnly cookie and forwarding it server-side to the active Supabase Edge Function.
- Strict Zod input validation for new text posts (1–500 characters); unknown fields are rejected, and server-side rate limits/moderation remain authoritative in the existing API.
- Signed-in-only post composer with character counter, pending/error/success states; it refreshes the real feed only after the server confirms the saved post.
- Authenticated per-post like and comment Route Handlers, comment reply Route Handler, bookmark list/create Route Handlers, and a batched personal-state endpoint for liked/saved/followed state. These proxy to the existing API and do not write directly to PostgreSQL from the browser.
- Login/register UI and challenge/verify/me/logout Route Handlers are present in the v2 build; they preserve the existing P-256 identity flow rather than claiming password auth is complete.
- Six unit cases for post input validation and unknown-field rejection.
- Branch-specific GitHub Actions workflow for lint, TypeScript, unit + legacy regression tests, and production build.
- Existing PWA source and entry file remain in the repository; main stays unchanged.

## Pinned direct dependencies

- Next.js 16.4.6; CI Node.js 22.
- React and React DOM 19.3.1.
- TypeScript 5.9.3.
- Tailwind CSS and PostCSS adapter 4.3.5.
- Zod 4.6.7.
- Vitest 5.1.0.
- ESLint 9.39.5 and eslint-config-next 16.4.6.
- Lucide React 1.74.0.

Direct dependencies are pinned. The npm lockfile still needs to be generated and committed before installs can be considered fully reproducible.

## Deliberately not implemented yet

- Password + HttpOnly session authentication. The current system uses a P-256 key pair and signed guest token. Existing accounts must prove key ownership before credential migration.
- Likes, comments, follows, bookmarks and messages from the Next.js UI. Existing backend and legacy PWA support these; they still need authenticated v2 flows and tests. Media attachments are not yet part of the new composer.
- Admin roles and admin routes.
- Search, reposts, mentions, blocks and mutes.
- Post expiry, cleanup cron and automatic report threshold.
- Video storage and third-party media providers.
- Redis, analytics and observability integrations.
- Additional external API adapters.

## Database and deployment safety

- This stage makes no Supabase schema changes and applies no migration.
- The new app reads public feed data and health, and creates authenticated text posts through the existing active `orbis-api` Edge Function (version 55).
- Service-role credentials and the guest HMAC secret are not included in the browser bundle or environment example.
- The live database has 19 recorded migrations while the main repository contains 9 migration SQL files. Reconstruct and verify migration history before applying new DDL.
- Vercel production remains on main. Cloudflare deployment remains optional and is not assumed active.

## Tests and outstanding verification

- The first CI run installed dependencies and found a theme-toggle lint violation. It was corrected by using React's external-store API instead of updating component state synchronously from an effect.
- A later PR CI run stopped before dependency installation because `actions/setup-node` was configured to cache npm while no `package-lock.json` exists yet. The workflow was corrected to omit npm caching until the lockfile is committed; no lint/type/test/build result can be inferred from that failed run.
- The same run then exposed that the root TypeScript config was also including Supabase's Deno Edge Function source. The Next.js TypeScript project now scopes its checks to src/, Next.js config and test files. The Edge Function is a separate Deno target and needs its own Deno type-check/test task; it is not silently represented as type-checked by tsc.
- The second run result: lint passed and tsc started; the diagnostics showed only Deno/remote-import scope mismatch, before the project boundary was corrected.
- A branch-specific workflow runs lint, app TypeScript, Vitest, legacy static regression tests and production build. The latest Vercel preview (`nextjs-v2`, commit `d12142a`) completed production compilation and TypeScript successfully and lists the auth, post, like, comment, reply and bookmark routes. GitHub Actions full-suite validation is still pending after the npm-cache workflow correction; the earlier failing run did not reach install/lint/tests.
- The latest GitHub static regression workflow completed successfully on commit `3510871`; the two Next.js full-suite workflow runs were still in progress at the time of this update.
- Browser E2E and cross-device auth recovery are not yet proven.

## Next stage

Rerun branch CI after the npm-cache correction and commit a reproducible lockfile. Add integration tests for likes/comments/replies/bookmarks against the active Edge Function, then implement authenticated profile reads/updates. Recover the reproducible migration baseline before any new DDL. Keep the current P-256 key recovery flow until a safe credential migration is explicitly built.
