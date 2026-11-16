# ORBIS — Supabase setup and security

## Connected project
- Project: `Orbis`
- Project ref: `wdwvcvpgovvkoodozbxf`
- Region: `ap-southeast-2`
- Database engine: PostgreSQL 17
- Storage bucket: `orbis-media`
- Edge Function: `orbis-api` (live version is checked through the Supabase project tools; version changes as code is deployed).

## Authentication model
ORBIS uses username-first guest identities backed by a cryptographic key, not username-only authentication:
1. The browser generates a random UUID and a P-256 ECDSA key pair.
2. The public key is stored in `profiles.auth_public_key`.
3. A one-use challenge is stored in `orbis_auth_challenges`, expires after five minutes and is marked used after successful verification.
4. The browser signs the challenge with its local private key. The server verifies the signature and returns a time-limited signed guest token.
5. The private key is held in IndexedDB as a non-exportable CryptoKey. A user can export an encrypted recovery file protected by a separate random recovery code.
6. The recovery file and recovery code must be kept separately. ORBIS cannot recover an account from its username alone.

The server's HMAC signing secret and Supabase service-role key stay in Edge Function secrets. Neither is embedded in frontend JavaScript.

## Tables used by the social product
- `profiles`: usernames, display names, bios, avatar URLs and public profile metadata.
- `posts`: text/photo posts and engagement score.
- `post_likes`, `follows`, `bookmarks`: relationship and engagement rows.
- `post_comments`: comments and one-level replies (`parent_id`).
- `notifications`: recipient-scoped activity notifications.
- `orbis_auth_challenges`: private, expiring login challenges.
- `api_rate_limits`: server-side rate-limit windows.
- Existing `orbis_daily_posts` tables remain in the database for compatibility with earlier ORBIS releases; the current main UI uses `posts`.

## Media
- Bucket: `orbis-media`.
- The browser converts selected photos to WebP (max edge 1,800 px, quality around 0.82) before upload.
- Up to four photos are sent together in one multipart request.
- The Edge Function checks MIME type, file size and the caller's UUID object-key prefix.
- Profile avatar updates accept only a URL under that same user's media prefix.
- Storage is persistent; IndexedDB is only a local cache, not the media origin.

## Access boundaries
- RLS remains enabled on public-schema application tables.
- Browser writes are routed through `orbis-api`; the service-role key bypasses RLS only on the server.
- Recovery challenges are inaccessible to `anon` and `authenticated` roles.
- Public cached feed payloads exclude personal liked/saved flags.
- Never grant a client the Supabase service-role key or remove RLS to fix a frontend issue.

## Verification notes
- Apply schema changes through tracked migrations and run Supabase advisors after changes.
- Exercise signup, recovery login, post/media upload, like, bookmark, comment, follow and notification flows in a dedicated test account.
- The current backend contains working handlers for these operations; a full multi-device end-to-end suite and high-concurrency test are still required before public scale claims.
