# ORBIS — Master Prompt Alignment and Implementation Roadmap

**Audit date:** 2026-11-17  
**Repository:** Mehdipro34/Orbis, branch main  
**Production:** https://orbis-mehdipro34.vercel.app  
**Supabase project:** wdwvcvpgovvkoodozbxf (PostgreSQL 17, active)

## 1. Decision: preserve production, build toward the requested architecture safely

The deployed product is currently a static HTML/CSS/JavaScript PWA backed by Vercel API routes and Supabase Edge Functions. It is not a Next.js/React/TypeScript application, and the repository currently has no root package.json or src/app App Router tree.

The master prompt asks for Next.js App Router, React, TypeScript, Tailwind, typed Route Handlers, and a broader social feature set. The target architecture will therefore be a Next.js application, but it must be developed on an isolated branch (proposed: nextjs-v2) and not replace the production PWA until the replacement passes the agreed end-to-end checks. Keep the existing database and user identities; do not create a second production Supabase project or force existing users to register again.

During migration, preserve the deployed application as the rollback path. The current Edge Function can initially remain the compatibility backend behind a typed server-side adapter. Move individual domains to Next.js Route Handlers only after equivalent behavior and security checks exist.

## 2. Current verified baseline

- Vercel is the production host; the latest Vercel deployment for commit 41b6b226ae6e68cb511a5c3c887032a2939c1ec3 is reported READY in deployment records. The current GitHub main head is 41b6b226ae6e68cb511a5c3c887032a2939c1ec3.
- Supabase project is active on PostgreSQL 17. The live database has 19 recorded migrations.
- orbis-api is ACTIVE, version 55. Its deployed index.ts exactly matches the GitHub main source. orbis-telegram-auth is ACTIVE, version 15.
- Current product includes P-256 key-based registration/login and recovery, global/following/popular feeds, profiles, text posts, up to four photo attachments, likes, bookmarks, one-level comments/replies, follows, notifications, stories, ad campaigns, conversations and clans in backend/UI modules.
- Current post table is public.posts. It has a 4,000-character body limit and no expires_at column. public.orbis_daily_posts is an older separate model retained for compatibility; it is not the current main feed model.
- Photo upload accepts JPEG, PNG and WebP, up to four files, 8 MB per file and 20 MB total. Video upload is not currently implemented by that route.
- Existing static CI reports 11/11 checks passing. This is not a substitute for full browser E2E or load testing.
- Cloudflare Worker deployment is optional and currently skipped when Cloudflare GitHub secrets are absent. Vercel remains the verified host.

## 3. Target application structure

The following is the target Next.js structure for the isolated v2 branch. It is a target layout, not a claim that these files already exist.

    src/
      app/
        (auth)/
          login/page.tsx
          register/page.tsx
          recovery/page.tsx
        (app)/
          layout.tsx
          page.tsx
          following/page.tsx
          popular/page.tsx
          notifications/page.tsx
          profile/[username]/page.tsx
          search/page.tsx
          settings/page.tsx
        admin/page.tsx
        api/
          auth/{register,login,logout,me,recovery}/route.ts
          users/route.ts
          users/[username]/route.ts
          posts/route.ts
          posts/[id]/route.ts
          posts/[id]/{like,comments,report}/route.ts
          uploads/{image,video}/route.ts
          notifications/route.ts
          ads/route.ts
          admin/{stats,users,reports,ads}/route.ts
          widgets/[name]/route.ts
      components/
        ui/
        layout/
        feed/
        posts/
        comments/
        profile/
        editor/
        media/
        ads/
        admin/
      features/
        auth/
        feed/
        posts/
        comments/
        profiles/
        notifications/
        moderation/
        advertising/
      lib/
        auth/
        supabase/{client,server,admin}.ts
        validation/
        rate-limit/
        cache/
        media/adapters/
        security/
      types/
      config/
    supabase/
      functions/orbis-api/       # compatibility backend during migration
      functions/orbis-telegram-auth/
      migrations/
    tests/
      unit/
      integration/
      sql/
    e2e/
      auth.spec.ts
      feed.spec.ts
      posts.spec.ts
      media.spec.ts
      moderation.spec.ts
      pwa.spec.ts

Keep server-only code (service-role client, password hashes, JWT signing, private storage operations and external API secrets) out of client components and browser bundles. Use Server Components for read-only screens where possible; use Client Components only for interaction.

## 4. Dependencies to pin when v2 is scaffolded

**Runtime:** Next.js, React, React DOM, TypeScript, Tailwind CSS, Lucide React, @supabase/supabase-js, @supabase/ssr, Zod, jose, bcryptjs, idb.

**Optional infrastructure integrations:** @upstash/redis, @upstash/ratelimit. Keep database-backed rate limiting as the fallback so the core app does not fail when optional Redis credentials are absent.

**Development/testing:** ESLint, Vitest, Playwright, TypeScript type checking. k6 is a separate load-testing CLI, not a required browser runtime dependency.

Pin exact compatible versions and commit the lockfile when scaffolding. Do not add a package or paid external service unless its need and free-tier limits are documented.

## 5. Database mapping and additive schema plan

Reuse existing data rather than creating a parallel social database:

| Domain | Existing source | v2 work |
|---|---|---|
| Identity/profile | profiles, account_lookup, orbis_auth_challenges | Preserve UUIDs and public profile data; introduce credential/session records without breaking P-256 recovery |
| Posts/feed | posts, post_likes, post_like_counts, follows, bookmarks | Add expiry and 500-character validation for new posts; retain stable cursor pagination and existing likes/bookmarks |
| Comments | post_comments | Verify current constraints; retain one-level replies unless product requirements explicitly change |
| Media | orbis-media Storage bucket and posts.media JSON | Keep file bytes out of PostgreSQL; introduce validated image/video adapters and metadata |
| Notifications | notifications | Add/verify notification kinds, recipient-scoped access and pagination |
| Moderation | post_reports, post status | Add moderation event/audit data and atomic distinct-reporter threshold |
| Ads | ad_campaigns, ad_events | Add role-checked campaign approval/management and deduplicated impressions/clicks |
| Admin | no verified protected role model in current profiles | Add a private role table; never trust client-editable profile fields for admin rights |
| Expiry | stories.expires_at only | Add post expiry; schedule safe cleanup after the legacy-data policy is agreed |

**Legacy-data protection:** do not assign old posts a 24-hour expiry automatically; doing so could delete existing user content on the next cleanup. Add nullable expiry for existing rows, set 24 or 48 hours on newly created posts, and decide separately how/if legacy posts are migrated. No production cleanup job should be enabled until this policy and a rollback/backup plan are approved.

**Migration-history blocker:** the live database records 19 migrations, but the repository currently contains only 9 migration files. Several live versions have no matching SQL file, and three migration names have different local timestamps. Reconcile and reconstruct a reproducible migration baseline before adding schema changes. Do not blindly re-run migrations or mark unknown migrations as applied/reverted.

## 6. Authentication and authorization target

- New password flow: username + password, server-side Zod validation, bcryptjs password hash, short-lived signed session, and an HttpOnly cookie (Secure in production, SameSite=Lax, Path=/). Keep CSRF/origin protections on state-changing requests.
- Account recovery without email/SMS: issue one-time recovery codes; store only hashes. Display the recovery secret once and tell users to store it separately from any encrypted backup.
- Existing-account migration: a user must prove control of the current P-256 key before linking a new password. Preserve the current key-based login/recovery until the user successfully completes linking; do not lock out existing accounts.
- Keep signing secrets separate from the Supabase service-role key. Rotate secrets through a planned dual-key/token-expiry process; never silently invalidate all current sessions.
- Keep SUPABASE_SERVICE_ROLE_KEY server-only. Enable RLS on exposed tables and grant only the roles and SQL privileges actually required. Service-role-only tables should remain inaccessible to browser roles; do not add permissive policies just to silence an advisor.
- Store admin and moderation privileges outside user-editable profile data and check them server-side on every privileged route.

## 7. API contract strategy

Provide the requested public routes through typed Next.js Route Handlers, while retaining compatibility with existing deployed routes during migration. Translate old contracts such as /api/guest/* and /api/posts/* through one adapter layer; do not duplicate business rules in both the old Edge Function and the new Route Handlers.

Every write route must have authentication, ownership/role checks, Zod validation, rate limiting, idempotency where retries are possible, consistent status codes, and safe error messages. External API adapters need timeouts, cancellation, response validation, caching where permitted, and a graceful unavailable state.

## 8. Delivery stages and acceptance

1. **Stage 0 — architecture/audit:** this document; map current routes, tables, auth, hosting and risks.
2. **Stage 1 — reproducible database:** recover/verify every migration, reconcile version history, document RLS/grants, add baseline tests. No destructive schema changes.
3. **Stage 2 — v2 foundation/auth:** isolated Next.js branch, environment template, server/client Supabase clients, dual-auth transition, recovery, profile pages.
4. **Stage 3 — social core:** posts, global/following/recommended feeds, stable cursor pagination, comments/replies, likes, bookmarks, follows and notifications.
5. **Stage 4 — media/editor:** photo pipeline first, then video only with a verified provider and documented limits; optional widgets remain non-blocking.
6. **Stage 5 — moderation/admin/ads:** private role model, reports, atomic distinct-user threshold, moderation audit, campaign review and deduplicated ad events.
7. **Stage 6 — PWA/performance:** offline-safe shell and per-user cache, Redis only where measured useful, monitoring, query/index review.
8. **Stage 7 — verification/cutover:** Vitest, SQL integration tests, Playwright flows, security/advisor review, staged k6 tests, production canary and rollback plan. Switch the production alias only after the full acceptance matrix passes.

## 9. Open risks and verified blockers

- Migration source/history drift must be fixed before further DDL.
- pg_cron and pg_trgm were not found in the enabled database extensions; cron.job does not currently exist. Verify extension availability and schedule through Supabase Cron before enabling post cleanup.
- Current app uses a custom P-256/HMAC guest-token model, not username/password + HttpOnly-cookie auth. Existing local auth material is in IndexedDB. Migrating auth requires a compatibility period.
- Current product permits a 4,000-character post body and 12 posts/hour, unlike the target's 500 characters and different rate policy. Apply new limits to new writes only after product policy is fixed.
- No verified admin-only panel/role system, broad media-adapter set, Redis integration, 24/48-hour post cleanup, or complete Next.js UI exists in the current shipped tree.
- Existing automated checks are static/contract checks. Browser E2E, recovery across browsers, media failure paths, cross-account isolation and load capacity are not yet proven.
- Free-tier quotas are ceilings, not user/concurrency guarantees. No 100,000-user or 100,000-concurrent-user capacity claim is supported.

## 10. Operational rule

Every later phase must record changed files, migration IDs, external keys required, tests run, deployment result and rollback steps. Never place secrets in this repository or chat. Do not deploy a database migration or switch production traffic merely because code compiles.
