# ORBIS staged load testing

This repository includes `tests/orbis-public-feed.k6.js`, a read-only public-feed load probe.

## Safe defaults
- Default target: 10 virtual users.
- Default traffic: one cached public feed GET per virtual user per second.
- The script never creates accounts, posts, comments or likes.
- Tests must run against a separate staging/preview deployment with owner approval.
- Do not run high-VU tests against the free production project.

## Run
```bash
k6 run -e ORBIS_BASE_URL=https://your-staging-host.example tests/orbis-public-feed.k6.js
```

For a controlled test above 100 VUs:
```bash
k6 run -e ORBIS_BASE_URL=https://your-staging-host.example -e MAX_VUS=500 -e CONFIRM_HIGH_LOAD=YES tests/orbis-public-feed.k6.js
```

The script refuses more than 1,000 VUs unless the hostname contains `staging`, `loadtest` or `preview`. This is a guardrail, not a guarantee that the test host can absorb that load. A 100,000-VU run needs a dedicated test environment and a load generator with enough CPU/network capacity; do not run it from an ordinary laptop or against free production services.

## What to measure
- Public CDN cache-hit ratio and cache age.
- p50/p95/p99 latency and HTTP 429/5xx rates.
- Supabase Edge Function invocations, database CPU/connections and slow queries.
- Image storage egress and upload error rates.
- Following-feed and authenticated write paths in a separate authenticated test plan.

Increase load gradually and stop immediately if error rate or latency rises, database connections approach the cap, or any provider sends quota warnings. No 100,000-concurrent-user test has been executed yet.
