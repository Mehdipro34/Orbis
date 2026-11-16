import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("frontend JavaScript parses", async () => {
  const source = await read("public/orbis-app.js");
  assert.doesNotThrow(() => new vm.Script(source, { filename: "public/orbis-app.js" }));
});

test("service worker parses and only caches app-shell requests", async () => {
  const source = await read("public/sw.js");
  assert.doesNotThrow(() => new vm.Script(source, { filename: "public/sw.js" }));
  assert.match(source, /const CACHE_NAME="orbis-shell-v5"/);
  assert.match(source, /url\.pathname\.startsWith\("\/api\/"\)\)return/);
  assert.match(source, /APP_SHELL=\[/);
});

test("Vercel public-feed handler parses and sets shared cache headers", async () => {
  const source = await read("api/public/posts.js");
  assert.doesNotThrow(() => new vm.Script(source, { filename: "api/public/posts.js" }));
  assert.match(source, /s-maxage=60/);
  assert.match(source, /stale-while-revalidate=300/);
  assert.match(source, /orbis-api\/api\/public\/posts/);
});

test("Cloudflare Worker module parses", async () => {
  const source = (await read("src/index.js")).replace("export default {", "const workerModule = {");
  assert.doesNotThrow(() => new vm.Script(source, { filename: "src/index.js" }));
  assert.match(source, /caches\.default/);
  assert.match(source, /\/api\/public\/posts/);
});

test("HTML IDs are unique and frontend static references exist", async () => {
  const html = await read("public/index.html");
  const js = await read("public/orbis-app.js");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, "Duplicate HTML id attributes detected");
  const known = new Set(ids);
  const referenced = [...js.matchAll(/\$\("([^"]+)"\)/g)].map((m) => m[1]);
  const dynamic = new Set(["retryFeed"]); // Created only in the feed-error state.
  const missing = [...new Set(referenced.filter((id) => !known.has(id) && !dynamic.has(id)))];
  assert.deepEqual(missing, [], "Frontend references missing HTML IDs");
  assert.match(html, /\/orbis-app\.js/);
  assert.match(html, /\/orbis\.css/);
  assert.match(html, /\/manifest\.webmanifest/);
});

test("frontend contains the real account, social and sync routes", async () => {
  const js = await read("public/orbis-app.js");
  for (const route of [
    "/api/guest/register", "/api/guest/challenge", "/api/guest/verify",
    "/api/guest/me", "/api/posts", "/api/posts/state", "/api/posts/",
    "/api/public/posts", "/api/sync/batch", "/api/media",
    "/api/profile/", "/api/notifications"
  ]) assert.ok(js.includes(route), "Missing client route: " + route);
  assert.match(js, /indexedDB\.open\(DB_NAME,2\)/);
  assert.match(js, /createObjectStore\("outbox"/);
  assert.match(js, /async function flushSyncQueue/);
});

test("backend includes idempotent sync and indexed following feed", async () => {
  const backend = await read("supabase/functions/orbis-api/index.ts");
  assert.match(backend, /\/api\/sync\/batch/);
  assert.match(backend, /orbis_sync_operations/);
  assert.match(backend, /orbis_following_feed/);
  assert.match(backend, /client_operation_id/);
  assert.match(backend, /auth_public_key/);
});
