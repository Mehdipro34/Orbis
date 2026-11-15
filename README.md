# ORBIS

A focused social-network project built around three core areas: a continuously refreshed post feed, recent-only Stories, and a topic-based Navigator.

## Product rules

- ORBIS accounts do not require Telegram or Google login.
- Gmail is collected as plain text in the initial registration flow; no confirmation email is sent.
- Profiles stay minimal: display name, unique username, short description.
- Main feed mixes eligible new and older posts and refreshes continuously.
- Stories are a separate recent-only stream.
- One post and one Story per account per day.
- Target platform intake: up to 100,000 posts and 100,000 Stories per day. This is a target, not a load-tested guarantee.
- Navigator is divided into topic streams with independent service boundaries.
- General Search is excluded.

## Repository structure

- `public/index.html` — responsive ORBIS interface.
- `src/index.js` — Cloudflare Worker API and Telegram webhook foundation.
- `wrangler.toml` — Worker and static asset configuration.
- `docs/ARCHITECTURE.md` — current product and technical specification.

## Current implementation status

The interface now reflects the clarified product direction: main feed, fresh Stories, topic Navigator, minimal profile preview, and no Search section.

The UI is still a front-end foundation. Registration, username reservation, persistent posts, Stories, Navigator APIs, Telegram archive integration, moderation and production monitoring are not implemented yet. Sample feed cards are explicitly marked as examples.

## Infrastructure notes

- GitHub stores source code.
- Cloudflare Workers serves the website and API.
- Telegram private channels are intended as internal archive storage, not as a user login method.
- A metadata database/index is required; Telegram channels alone are not a queryable database.
- Keep bot tokens, webhook secrets and database credentials in Cloudflare secrets. Never commit or send them in chat.
- Free-tier quotas must be measured. Do not infer concurrency or million-user capacity from the number of Worker deployments.

## Next engineering milestones

1. Add a metadata database and migrations.
2. Implement secure account creation, login and atomic username uniqueness.
3. Implement Posts API, daily quota and Telegram archive pipeline.
4. Implement cursor-based main feed assembly.
5. Implement Stories API, expiry and daily quota.
6. Implement independent topic Navigator services.
7. Add monitoring, moderation and load tests.
