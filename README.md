# ORBIS

Telegram-first social network prototype built with Cloudflare Workers.

## Repository structure

- `public/index.html` — first responsive Telegram Mini App interface.
- `src/index.js` — Cloudflare Worker and Telegram webhook foundation.
- `wrangler.toml` — Worker and static asset configuration.

## Cloudflare Worker

Required secrets in Worker settings:

- `BOT_TOKEN`
- `WEBHOOK_SECRET`

Never commit secrets to GitHub or share them in chat.

Static assets are served from `public/` by Cloudflare Workers Static Assets. The Worker retains API routes such as `/health`, `/setup`, and `/telegram`.

## Current prototype status

The first UI includes a responsive feed layout, navigation, category filters, a post composer preview, and Telegram Web App initialization.

The interface is currently a visual prototype. Posts are not yet saved, photo uploads are not active, and real Telegram user authentication, database/storage, moderation, and a production feed have not yet been implemented.

## Next implementation stages

1. Verify deployment and Telegram webhook.
2. Validate Telegram Mini App init data on the server.
3. Add persistent post storage and feed API.
4. Add image upload/archive workflow.
5. Connect the bot menu button to the Mini App URL.
