# ORBIS — Your world. Your voice.

ORBIS is an international social network. The current production PWA remains available on main while the Next.js App Router replacement is developed in nextjs-v2.

## Production

- Live application: https://orbis-mehdipro34.vercel.app
- Existing PWA: public/index.html, public/orbis-app.js and public/orbis.css.
- Persistent data and write API: Supabase PostgreSQL and the orbis-api Edge Function.
- Existing accounts use P-256 key-based login and an encrypted recovery file. Do not delete local recovery data.

## Next.js v2 branch

- Next.js 16, React 19 and strict TypeScript.
- Tailwind CSS 4, ESLint flat config and Vitest.
- Live read-only public feed through a validated server-side adapter.
- Public feed caching, keyset pagination, loading/error states and a persistent dark/light theme.
- Shared security headers.

The new UI reads the existing public feed. Authentication and write actions will be migrated separately; they are not presented as complete in the new UI.

## Development

Requires Node.js 22.

    npm install
    npm run dev

Quality checks:

    npm run lint
    npm run typecheck
    npm run test
    npm run build

## Documentation

- docs/ARCHITECTURE.md — current system architecture.
- docs/MASTER_PROMPT_ALIGNMENT.md — requirements mapping and staged plan.
- docs/NEXTJS_MIGRATION.md — transition and auth compatibility.
- docs/PROJECT_STATUS.md — implementation status and remaining work.
- docs/SUPABASE_SETUP.md — database and secret boundaries.

Do not change the production alias until the new app passes account recovery, social writes, media, moderation, security and browser E2E checks. The service-role key and guest HMAC secret stay server-only.
