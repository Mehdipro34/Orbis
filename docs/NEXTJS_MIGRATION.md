# ORBIS Next.js migration

## Why this is a parallel branch

The production PWA is already in use. The Next.js App Router replacement is developed on nextjs-v2; main remains the rollback path until registration, recovery, posting, media and social actions have equivalent E2E coverage.

## Current request flow

Browser -> Next.js GET /api/posts -> server-side adapter -> Supabase Edge Function orbis-api -> PostgreSQL public posts and aggregate like counts -> validated public JSON -> browser.

The public response has no viewer-specific liked or saved state. Shared cache headers are used only on this public read endpoint.

## Existing authentication compatibility

Current ORBIS identity uses a client-generated P-256 key pair, a one-use challenge and a signed guest token. The private key lives locally in the legacy PWA; the server validates its signature. This token is not a Supabase Auth JWT and must not be passed to auth.getUser or assumed to populate auth.uid().

Do not move existing users to password login until each account proves possession of its current private key and a dual-login migration has been implemented. Never put the service-role key or HMAC signing secret in browser code.

## Environment and secrets

The Supabase project URL and publishable key are public connection details and can be overridden with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. The current published config is a fallback for the read-only public feed.

Never use NEXT_PUBLIC_ for a service-role key, signing secret, recovery code or provider secret.

## Local development

1. Install Node.js 22.
2. Copy .env.example to .env.local if overriding public Supabase configuration.
3. Run npm install.
4. Run npm run dev.
5. Open http://localhost:3000.

## Verification

- npm run lint
- npm run typecheck
- npm run test
- npm run build

Unit tests mock network requests. Runtime GET /api/health and GET /api/posts call the configured Supabase project. The UI shows an error state if the backend is unavailable; it does not insert sample posts.

## Cutover gates

- Migration history reconciled with live database.
- Existing-account recovery and key-ownership migration verified.
- Post/photo creation and social actions reproduced with owner checks.
- Admin and moderation roles checked server-side.
- Browser E2E across two accounts and two browser profiles.
- Security and load tests in staging.
- Production canary and rollback plan approved.
