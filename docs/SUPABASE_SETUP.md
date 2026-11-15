# ORBIS — Supabase setup

## Deployed components

- Supabase project: `Orbis` (`wdwvcvpgovvkoodozbxf`).
- Edge Function: `orbis-api` (active version 27 at the latest verification).
- Storage bucket: `orbis-media`.
- Authentication: email + password, with a unique username stored in the public profile.
- Username-to-email lookup: `account_lookup`, blocked from direct `anon` and `authenticated` access.
- Application tables have Row Level Security enabled. Tables accessed only through the service-role Edge Function intentionally have no direct browser policies; the function must validate the JWT and enforce ownership or conversation membership before every operation.

## Account flow

1. A user signs up with email, username and password through Supabase Auth.
2. The `on_auth_user_created_orbis` database trigger creates the profile and a private `account_lookup` row.
3. Login accepts either an email address or username. For username login, `orbis-api` resolves the email server-side and exchanges the credentials with Supabase Auth.
4. The browser receives the resulting Supabase session, not the account email belonging to another user.
5. Passwords are never stored in public profile or lookup tables.

## Required Auth configuration

1. In Authentication → Sign In / Providers, ensure the Email provider is enabled.
2. Keep email confirmation enabled.
3. In Authentication → URL Configuration, set the Site URL and Redirect URLs to include `https://orbis-mehdipro34.vercel.app`.
4. Enable leaked-password protection in Auth password security settings.
5. Never expose the service-role key in browser JavaScript.

## Media

- The `orbis-media` bucket exists and is public-read for media URLs.
- Uploads are performed by `orbis-api` using the server-side service-role client.
- The API validates the authenticated user, allowed MIME types, file sizes and ownership of uploaded object keys.
- Cloudflare R2 is not required for the current storage design.

## Verification status

- Supabase project status: `ACTIVE_HEALTHY`.
- The latest migration adds the private username/email mapping and updates the auth-user trigger.
- The database currently contains one profile, one private account lookup row, zero posts and zero Stories.
- The Edge Function is active at version 27 and includes the email/username login endpoint.
- The latest Vercel production deployment reported `READY`.
- A real end-to-end account registration, email confirmation, username login and media upload test has not yet been completed.
- Supabase Security Advisor reports leaked-password protection disabled. Enable it before broad public launch.
- The Security Advisor also reports some RLS-enabled service-only tables without direct client policies. This is intentional for tables accessed only through the authenticated Edge Function; do not grant direct browser access as a shortcut.

## Capacity

No load test has been run. Free-tier quotas can pause or throttle the project. Do not claim a specific supported number of users or concurrent sessions until measured.
