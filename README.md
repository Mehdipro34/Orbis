# ORBIS

Telegram-first social network starter built on Cloudflare Workers.

## Current foundation

- Cloudflare Worker HTTP API
- Telegram webhook verification using `WEBHOOK_SECRET`
- Telegram Bot API helper
- Health endpoint at `/health`
- Protected webhook setup endpoint at `POST /setup`

## Required Worker secrets

Set these in Cloudflare Worker settings. Never commit them to Git:

- `BOT_TOKEN`
- `WEBHOOK_SECRET`

## Configure the webhook

Send a POST request to `/setup` with the header:

```
x-orbis-setup: YOUR_WEBHOOK_SECRET
```

The Worker registers `/telegram` as the Telegram webhook.

## Test

- Open `/health` in a browser; expect JSON with `ok: true`.
- Send `/orbis_test` to the bot; expect a confirmation message.

## Important

This is the initial integration foundation, not the complete social network. It does not yet include persistent post storage, feed generation, media archival, Mini App authentication, moderation, or production-scale capacity. Those features require a deliberate next implementation stage.
