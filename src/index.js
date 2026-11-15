const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const SESSION_TTL = 60 * 60 * 24 * 30;
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,24}$/;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}
function randomHex(bytes = 24) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return Array.from(value, x => x.toString(16).padStart(2, "0")).join("");
}
async function sha256(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, "0")).join("");
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 120000, hash: "SHA-256" }, key, 256);
  return Array.from(new Uint8Array(bits), x => x.toString(16).padStart(2, "0")).join("");
}
function cookieValue(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[1]) : "";
}
async function currentUser(request, env) {
  if (!env.ORBIS_KV) return null;
  const token = cookieValue(request, "orbis_session");
  if (!token) return null;
  const username = await env.ORBIS_KV.get("session:" + await sha256(token));
  if (!username) return null;
  return await env.ORBIS_KV.get("user:" + username, "json");
}
async function requireKV(env) {
  if (!env.ORBIS_KV) throw new Error("KV_BINDING_MISSING");
}
async function telegram(method, env, payload) {
  if (!env.BOT_TOKEN) throw new Error("BOT_TOKEN_MISSING");
  const response = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || "Telegram API error");
  return result;
}
async function allPosts(env, limit = 100) {
  const listed = await env.ORBIS_KV.list({ prefix: "post:", limit: 1000 });
  const keys = listed.keys.map(x => x.name).sort().reverse().slice(0, limit);
  const values = await Promise.all(keys.map(key => env.ORBIS_KV.get(key, "json")));
  return values.filter(Boolean);
}
async function api(request, env, url) {
  await requireKV(env);
  const path = url.pathname;
  if (request.method === "GET" && path === "/api/health") {
    return json({ ok: true, service: "orbissocial", storage: "kv-index", telegramArchive: Boolean(env.BOT_TOKEN && env.POSTS_CHANNEL_ID) });
  }
  if (request.method === "POST" && path === "/api/auth/register") {
    const body = await request.json();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const email = String(body.email || "").trim().slice(0, 120);
    if (!USERNAME_RE.test(username)) return json({ error: "Username должен содержать 3–24 символа: латиница, цифры, точка или _." }, 400);
    if (password.length < 8 || password.length > 128) return json({ error: "Пароль должен содержать от 8 до 128 символов." }, 400);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Проверь адрес электронной почты." }, 400);
    if (await env.ORBIS_KV.get("user:" + username)) return json({ error: "Этот username уже занят." }, 409);
    const salt = randomHex(16);
    const user = { username, name: username, bio: "", email, salt, passwordHash: await passwordHash(password, salt), createdAt: new Date().toISOString() };
    await env.ORBIS_KV.put("user:" + username, JSON.stringify(user));
    const token = randomHex(32);
    await env.ORBIS_KV.put("session:" + await sha256(token), username, { expirationTtl: SESSION_TTL });
    const safeUser = { username, name: user.name, bio: user.bio, createdAt: user.createdAt };
    return json({ ok: true, user: safeUser }, 201, { "set-cookie": "orbis_session=" + encodeURIComponent(token) + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" + SESSION_TTL });
  }
  if (request.method === "POST" && path === "/api/auth/login") {
    const body = await request.json();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const user = await env.ORBIS_KV.get("user:" + username, "json");
    if (!user || await passwordHash(password, user.salt) !== user.passwordHash) return json({ error: "Неверный username или пароль." }, 401);
    const token = randomHex(32);
    await env.ORBIS_KV.put("session:" + await sha256(token), username, { expirationTtl: SESSION_TTL });
    return json({ ok: true, user: { username, name: user.name, bio: user.bio, createdAt: user.createdAt } }, 200, { "set-cookie": "orbis_session=" + encodeURIComponent(token) + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" + SESSION_TTL });
  }
  if (request.method === "POST" && path === "/api/auth/logout") {
    const token = cookieValue(request, "orbis_session");
    if (token) await env.ORBIS_KV.delete("session:" + await sha256(token));
    return json({ ok: true }, 200, { "set-cookie": "orbis_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" });
  }
  if (request.method === "GET" && path === "/api/auth/me") {
    const user = await currentUser(request, env);
    if (!user) return json({ authenticated: false }, 401);
    return json({ authenticated: true, user: { username: user.username, name: user.name, bio: user.bio, createdAt: user.createdAt } });
  }
  if (request.method === "GET" && path === "/api/posts") {
    return json({ posts: await allPosts(env, 100) });
  }
  if (request.method === "POST" && path === "/api/posts") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Сначала войди в ORBIS." }, 401);
    if (!env.POSTS_CHANNEL_ID) return json({ error: "Не настроен POSTS_CHANNEL_ID в Cloudflare." }, 503);
    const body = await request.json();
    const title = String(body.title || "").trim().slice(0, 120);
    const topic = String(body.topic || "").trim().slice(0, 48);
    const text = String(body.body || "").trim().slice(0, 3000);
    if (!title || !topic || !text) return json({ error: "Заполни название, тему и текст публикации." }, 400);
    const post = { id: crypto.randomUUID(), title, topic, body: text, username: user.username, author: user.name, createdAt: new Date().toISOString() };
    const archiveText = "ORBIS · НОВАЯ ПУБЛИКАЦИЯ\n" + title + "\nТема: " + topic + "\nАвтор: @" + user.username + "\n\n" + text + "\n\nID: " + post.id;
    try {
      const archived = await telegram("sendMessage", env, { chat_id: env.POSTS_CHANNEL_ID, text: archiveText, disable_web_page_preview: true });
      post.telegramMessageId = archived.result.message_id;
      post.archived = true;
    } catch (error) {
      return json({ error: "Не удалось сохранить публикацию в Telegram: " + error.message }, 502);
    }
    await env.ORBIS_KV.put("post:" + Date.now().toString().padStart(13, "0") + ":" + post.id, JSON.stringify(post));
    return json({ ok: true, post }, 201);
  }
  if (request.method === "PUT" && path === "/api/profile") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Сначала войди в ORBIS." }, 401);
    const body = await request.json();
    const name = String(body.name || "").trim();
    const bio = String(body.bio || "").trim();
    if (name.length < 2 || name.length > 32) return json({ error: "Имя должно содержать 2–32 символа." }, 400);
    if (bio.length > 180) return json({ error: "Описание профиля слишком длинное." }, 400);
    const updated = { ...user, name, bio };
    await env.ORBIS_KV.put("user:" + user.username, JSON.stringify(updated));
    return json({ ok: true, user: { username: updated.username, name, bio, createdAt: updated.createdAt } });
  }
  if (request.method === "GET" && path.startsWith("/api/profile/")) {
    const username = decodeURIComponent(path.slice("/api/profile/".length)).toLowerCase();
    const user = await env.ORBIS_KV.get("user:" + username, "json");
    if (!user) return json({ error: "Профиль не найден." }, 404);
    const posts = (await allPosts(env, 100)).filter(post => post.username === username);
    return json({ user: { username, name: user.name, bio: user.bio, createdAt: user.createdAt }, posts });
  }
  if (request.method === "GET" && path === "/api/navigator") {
    const posts = await allPosts(env, 1000);
    const counts = {};
    for (const post of posts) counts[post.topic] = (counts[post.topic] || 0) + 1;
    const topics = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    return json({ topics });
  }
  return json({ error: "API route not found." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(request, env, url);
      } catch (error) {
        if (error.message === "KV_BINDING_MISSING") return json({ error: "Не подключено хранилище ORBIS_KV. Создай KV namespace и добавь binding ORBIS_KV." }, 503);
        return json({ error: "Ошибка сервера ORBIS. " + error.message }, 500);
      }
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "orbissocial", version: "0.2.0" });
    }
    if (request.method === "POST" && url.pathname === "/setup") {
      if (!env.WEBHOOK_SECRET || request.headers.get("x-orbis-setup") !== env.WEBHOOK_SECRET) return new Response("Unauthorized", { status: 401 });
      if (!env.BOT_TOKEN) return json({ ok: false, error: "BOT_TOKEN is not configured" }, 500);
      const webhookUrl = url.origin + "/telegram";
      const result = await telegram("setWebhook", env, { url: webhookUrl, secret_token: env.WEBHOOK_SECRET, allowed_updates: ["message", "channel_post"] });
      return json({ ok: true, webhook: webhookUrl, telegram: result.result });
    }
    if (request.method === "POST" && url.pathname === "/telegram") {
      if (!env.WEBHOOK_SECRET || request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return new Response("Unauthorized", { status: 401 });
      let update;
      try { update = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
      const message = update.message || update.channel_post;
      if (message && message.text === "/orbis_test" && message.chat && message.chat.id) {
        await telegram("sendMessage", env, { chat_id: message.chat.id, text: "ORBIS подключён к Telegram. API работает." });
      }
      return new Response("OK");
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ app: "ORBIS", status: "online", version: "0.2.0" });
  }
};
