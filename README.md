# ORBIS — Your world. Your voice.

ORBIS is an international social network. The current production PWA remains available on main while the Next.js App Router replacement is developed in nextjs-v2.

## Production

- Live application: https://orbis-mehdipro34.vercel.app
- Existing PWA: public/index.html, public/orbis-app.js and public/orbis.css.
- Persistent data and write API: Supabase PostgreSQL and the orbis-api Edge Function.
- Existing accounts use P-256 key-based login and an encrypted ORBIS-KEY-1 recovery file. Keep the file and secret code separately.

## Next.js v2 preview

- Preview: https://orbis-git-nextjs-v2-mehdipro34.vercel.app
- Next.js 16, React 19 and strict TypeScript.
- Tailwind CSS 4, ESLint flat config and Vitest.
- Live public feed through a validated server-side Supabase adapter.
- P-256 registration and recovery bridge to the existing guest identity backend.
- Guest session token held in an HttpOnly cookie; the token is not returned to browser JavaScript.
- Dark/light theme, responsive interface, loading/error handling and keyset pagination.

The auth bridge deliberately preserves existing accounts. Username/password auth and revocable database sessions are not added yet; they require an additive schema migration and a tested dual-auth transition.

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
- docs/MASTER_PROMPT_ALIGNMENT.md — requirement mapping and staged plan.
- docs/NEXTJS_MIGRATION.md — migration, trust boundaries and auth compatibility.
- docs/PROJECT_STATUS.md — implementation status and remaining work.
- docs/SUPABASE_SETUP.md — database and secret boundaries.

The production alias remains on main. Do not switch it until account recovery, authenticated social actions, media, moderation, security and browser E2E checks pass. The service-role key and guest HMAC signing secret stay server-side.
