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
- Existing PWA source and entry file remain in the repository; main stays unchanged.

## Pinned direct dependencies

- Next.js 16.4.6; CI Node.js 22.
- React and React DOM 19.3.1.
- TypeScript 5.9.3.
- Tailwind CSS and PostCSS adapter 4.3.5.
- Zod 4.6.7.
- Vitest 5.1.0.
- ESLint 10.15.0 and eslint-config-next 16.4.6.
- Lucide React 1.74.0.

Direct dependencies are pinned. The npm lockfile still needs to be generated and committed before installs can be considered fully reproducible.

## Deliberately not implemented yet

- Password + HttpOnly session authentication. The current system uses a P-256 key pair and signed guest token. Existing accounts must prove key ownership before credential migration.
- Post creation, likes, comments, follows, bookmarks and messages from the Next.js UI. Existing backend and legacy PWA support these; they must be ported with authenticated request flows and tests.
- Admin roles and admin routes.
- Search, reposts, mentions, blocks and mutes.
- Post expiry, cleanup cron and automatic report threshold.
- Video storage and third-party media providers.
- Redis, analytics and observability integrations.
- Additional external API adapters.

## Database and deployment safety

- This stage makes no Supabase schema changes and applies no migration.
- The new app reads only public feed data and the health endpoint.
- Service-role credentials and the guest HMAC secret are not included in the browser bundle or environment example.
- The live database has 19 recorded migrations while the main repository contains 9 migration SQL files. Reconstruct and verify migration history before applying new DDL.
- Vercel production remains on main. Cloudflare deployment remains optional and is not assumed active.

## Tests and outstanding verification

The first Next.js v2 CI run installed dependencies and found one lint error in theme persistence (synchronous state update inside an effect) plus a lint warning from the standalone k6 scenario. Both sources have been corrected without disabling lint rules. The workflow is rerun on the corrected commit; TypeScript, unit tests, legacy static tests and production build remain unverified until that run finishes. Browser E2E and cross-device auth recovery are not yet proven.

## Next stage

Recover a reproducible migration baseline and document the trust boundary around custom P-256 guest sessions. Then implement auth compatibility in the Next.js client and server route layer, followed by profile and social write actions.
