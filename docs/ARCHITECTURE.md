# ORBIS — Architecture and Product Requirements

Status: working architecture draft. This document records the owner's stated requirements; items marked OPEN require confirmation before implementation.

## 1. Product shape

- ORBIS is a social network, not merely a Telegram bot.
- Initial client: Telegram Mini App and a separately accessible website.
- Future clients: Android and iOS applications using the same backend and account system.
- A person must be able to create and use an ORBIS account without having or installing Telegram.
- Telegram is an internal storage/archival transport for ORBIS data and media; it is not the required user login provider.
- A user should not have to manually fill out technical storage details in the app. ORBIS assigns IDs and storage locations automatically.

## 2. Account and profile

- ORBIS-owned accounts with unique usernames.
- Username availability checked by the backend at registration and rechecked atomically when claimed.
- Profile data includes an internal user ID, display name, username, profile fields, avatar/media references, and timestamps.
- Authentication must be independent of Telegram.
- Passwords must never be stored in plaintext; use a purpose-built authentication service or a secure password-hashing implementation.
- Account recovery method is OPEN: email, phone/SMS, or both.
- Exact required profile fields and verification policy are OPEN.

## 3. Onboarding / access gate

The owner described an entry condition involving:
- sharing an invitation link with at least 15 people; and
- watching advertisements and/or completing other entry steps.

OPEN: confirm whether all 15 invitees must register, merely receive the link, or whether this is a referral target; confirm how ad views are counted and whether this is an access requirement, a reward mechanic, or optional promotion.

Implementation must not trust client-side counters. Referral attribution and ad completion must be verified server-side through supported provider callbacks. Do not promise ad availability or count views without a provider integration. Provide an accessible alternative if a user cannot complete the gate, subject to the owner's product decision. Do not require users to spam contacts.

## 4. Independent backend components

The architecture should separate responsibilities into independently deployable services/workers, with independent scaling and fault boundaries. Initial logical components:

- API Gateway / request router
- Auth and session service
- User profile service
- Username availability / reservation service
- Posts service
- Reels service
- Stories service
- Posts Navigator
- Reels Navigator
- Stories Navigator
- Hashtag Names service
- Hashtag Feed service
- Interests service
- Search service
- Notifications service
- Moderation service
- Storage Manager
- Health / monitoring / failover coordinator

Each Navigator is a separate component with its own deployment boundary. Components communicate through authenticated APIs and/or queues. A failure in one component should not take down unrelated features where practical.

"Separate component" does not automatically mean a separate paid physical server. Start with independent deployable Workers where free-plan limits allow; validate quotas and failure behavior. Add additional providers/nodes only after measured need. Do not claim high availability or million-user capacity until load-tested.

## 5. Telegram storage design

Telegram private channels are intended as an internal archive for user data and media, with separated logical storage groups such as:

- profile assets
- posts
- reels
- stories
- general media
- archives / backups

Storage Manager assigns a storage shard/channel and records the Telegram chat/message/file references in a metadata index. Do not create one channel per user by default; use sharding to avoid unmanageable channel counts.

Important constraints:
- Telegram channels are not a relational database and do not provide efficient arbitrary queries.
- Keep a metadata index for user IDs, post IDs, ownership, timestamps, tags, storage shard and Telegram message/file references.
- Never expose bot tokens or private channel identifiers to clients.
- Telegram bot API limits, file handling limits, channel permissions, retention and backup behavior must be tested.
- Telegram must not be the only copy of critical account credentials or security state.
- The app must continue to identify stored records even if a storage bot/channel is temporarily unavailable.

## 6. Data and storage model

Core records (logical schema):
- User: user_id, username_normalized, display_name, password_hash or external-auth reference, profile fields, created_at, status.
- Session: session_id, user_id, expiry, revocation state.
- Post: post_id, author_id, type, text/caption, created_at, visibility, media references, tags.
- MediaObject: media_id, owner_id, media_type, size, checksum, telegram_storage_shard, telegram_chat_id, telegram_message_id/file reference, created_at.
- Referral: referral_code, inviter_user_id, invitee_user_id, status, timestamps.
- AdCompletion: provider, provider_event_id, user_id, status, verified_at (only if a legitimate ad provider supports verifiable callbacks).
- Navigator indexes: references to eligible content, ranking metadata and cursors.

## 7. Web, Mini App and future mobile apps

- Website and Telegram Mini App should use the same ORBIS account/backend APIs.
- Telegram Mini App is an optional client, not an identity dependency.
- A public website entry/login route is required.
- Future Android/iOS clients should reuse the same APIs and account IDs.
- Do not assume a static HTML mockup is a working app.

## 8. Infrastructure constraints

- Strong preference for zero mandatory budget: no required paid hosting, database, API, or subscription.
- Domain and advertising may be acceptable future costs.
- Use free tiers only where their limits are documented and suitable.
- Clearly identify free-tier quotas, request limits, storage limits, egress limits, and terms that may change.
- No claim of supporting 1,000,000 users, 100,000 daily items per media type, or large concurrency until measured and independently validated.
- Build a small working vertical slice first, then scale by measured bottlenecks.

## 9. Current known repository state

- Repository: https://github.com/Mehdipro34/Orbis
- Cloudflare Worker: orbissocial
- Existing files: wrangler.toml, src/index.js, public/index.html, README.md
- Existing Worker is a basic health/webhook foundation.
- Existing HTML is a visual prototype only.
- Real account registration, username reservation, persistent posts, real photo/video upload, metadata indexing, Telegram archive integration, referral verification, ad verification, and independent Navigator services are not yet implemented.
- Existing webhook setup previously returned Unauthorized and is not confirmed operational.
- Existing secrets must remain private and must never be requested in chat.

## 10. Build order

1. Confirm product rules for referral gate, ads, and account recovery.
2. Finalize service boundaries and data contracts.
3. Build auth + username reservation + profile vertical slice.
4. Build metadata index and Telegram Storage Manager with a test channel.
5. Build Posts service and Posts Navigator end-to-end.
6. Add Reels and Stories services and their separate Navigators.
7. Add hashtags, interests, search, moderation and notifications.
8. Add referral/ad verification only after provider and exact rules are confirmed.
9. Connect website and Telegram Mini App; later mobile clients.
10. Load-test, document free-tier ceilings, and only then add more nodes/providers.

## 11. Open decisions

- Does "invite 15 people" mean 15 link shares, 15 sign-ups, or 15 verified active users?
- Are ads mandatory to unlock initial access, or are they an optional reward/monetization mechanic?
- Which ad provider is acceptable and available in the target regions?
- Account recovery: email, phone/SMS, or both?
- Is email verification required?
- Which exact profile fields are mandatory?
- Are Telegram storage channels already created for specific categories, and what categories do they represent?
