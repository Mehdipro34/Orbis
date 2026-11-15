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
async function rateLimit(request, env, action, limit, windowSeconds) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return true;
  const key = "ratelimit:" + action + ":" + await sha256(ip);
  const now = Date.now();
  let state = await env.ORBIS_KV.get(key, "json");
  if (!state || now - Number(state.startedAt || 0) >= windowSeconds * 1000) {
    state = { startedAt: now, count: 0 };
  }
  state.count = Number(state.count || 0) + 1;
  await env.ORBIS_KV.put(key, JSON.stringify(state), { expirationTtl: windowSeconds });
  return state.count <= limit;
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
async function allPosts(env, limit = 100, offset = 0) {
  // KV list is paginated. Walk pages so older posts do not hide newer ones
  // after the first 1,000 keys. Cap one request at 10 pages for predictable cost.
  const names = [];
  let cursor;
  let pages = 0;
  do {
    const options = { prefix: "post:", limit: 1000 };
    if (cursor) options.cursor = cursor;
    const listed = await env.ORBIS_KV.list(options);
    names.push(...listed.keys.map(x => x.name));
    cursor = listed.list_complete ? undefined : listed.cursor;
    pages += 1;
  } while (cursor && pages < 10);
  const keys = names.sort().reverse().slice(Math.max(0, offset), Math.max(0, offset) + limit);
  const values = await Promise.all(keys.map(key => env.ORBIS_KV.get(key, "json")));
  return values.filter(Boolean);
}
async function findPost(env, id) {
  const direct = await env.ORBIS_KV.get("postid:" + id);
  if (direct) return env.ORBIS_KV.get(direct, "json");
  const posts = await allPosts(env, 10000);
  return posts.find(post => post.id === id) || null;
}
async function listPrefix(env, prefix, cap = 1000) {
  const names = [];
  let cursor;
  let pages = 0;
  do {
    const options = { prefix, limit: 1000 };
    if (cursor) options.cursor = cursor;
    const result = await env.ORBIS_KV.list(options);
    names.push(...result.keys.map(key => key.name));
    cursor = result.list_complete ? undefined : result.cursor;
    pages++;
  } while (cursor && names.length < cap && pages < 10);
  return names.slice(0, cap);
}
async function postView(env, post, user) {
  const stats = await env.ORBIS_KV.get("poststats:" + post.id, "json") || { likes: 0 };
  const liked = user ? Boolean(await env.ORBIS_KV.get("like:" + post.id + ":" + user.username)) : false;
  return { ...post, likes: Number(stats.likes || 0), liked };
}

const NEWS_SOURCES = {
  "bbc-ru": { name: "BBC News · Русский", url: "https://feeds.bbci.co.uk/russian/rss.xml", language: "Русский", credit: "BBC News", allowedHosts: ["bbc.com", "bbc.co.uk"] },
  "oxu-az": { name: "Oxu.az", url: "https://oxu.az/feed", language: "Азербайджанский", credit: "Oxu.az", allowedHosts: ["oxu.az"] },
  "bbc-world": { name: "BBC News · Мир", url: "https://feeds.bbci.co.uk/news/world/rss.xml", language: "English", credit: "BBC News", allowedHosts: ["bbc.com", "bbc.co.uk"] },
  "aljazeera-en": { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", language: "English", credit: "Al Jazeera", allowedHosts: ["aljazeera.com"] }
};
function decodeXml(value) {
  return String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code) => {
    const n = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : parseInt(code, 10);
    try { return Number.isFinite(n) ? String.fromCodePoint(n) : ""; } catch { return ""; }
  }).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"' ).replace(/&apos;|&#39;/g, "'").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function xmlTag(block, names) {
  for (const name of names) { const match = block.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + "\\s*>", "i")); if (match) return decodeXml(match[1]); }
  return "";
}
function parseNewsXml(xml, source, limit = 30) {
  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/gi)].map(m => m[2]);
  const entries = [];
  for (const block of blocks.slice(0, limit)) {
    const title = xmlTag(block, ["title"]);
    let link = xmlTag(block, ["link"]);
    if (!link) { const lm = block.match(/<link\b[^>]*href=["\']([^"\']+)["\'][^>]*\/?\s*>/i); if (lm) link = decodeXml(lm[1]); }
    const description = xmlTag(block, ["description", "summary", "content:encoded", "content"]);
    const dateText = xmlTag(block, ["pubDate", "published", "updated", "dc:date"]);
    let safeUrl = ""; try { const parsed = new URL(link); const hostAllowed = !source.allowedHosts || source.allowedHosts.some(host => parsed.hostname === host || parsed.hostname.endsWith("." + host)); if (parsed.protocol === "https:" && hostAllowed) safeUrl = parsed.href; } catch {}
    if (!title || !safeUrl) continue;
    entries.push({ title: title.slice(0,220), summary: description.slice(0,source.teaserLimit || 260), url: safeUrl, publishedAt: dateText && !Number.isNaN(Date.parse(dateText)) ? new Date(dateText).toISOString() : null, source: source.name, credit: source.credit });
  }
  return entries;
}
async function api(request, env, url) {
  await requireKV(env);
  const path = url.pathname;
  if (request.method === "GET" && path === "/api/health") {
    return json({ ok: true, service: "orbissocial", storage: "kv-index", telegramArchive: Boolean(env.BOT_TOKEN && env.POSTS_CHANNEL_ID) });
  }
  if (request.method === "POST" && path === "/api/auth/register") {
    if (!await rateLimit(request, env, "register", 6, 900)) return json({ error: "Слишком много попыток регистрации. Попробуй позже." }, 429);
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
    if (!await rateLimit(request, env, "login", 10, 900)) return json({ error: "Слишком много попыток входа. Подожди 15 минут." }, 429);
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
  if (request.method === "POST" && path === "/api/media") {
    if (!await rateLimit(request, env, "media", 20, 60)) return json({ error: "Слишком много загрузок. Попробуй через минуту." }, 429);
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Войди, чтобы загружать медиа." }, 401);
    if (!env.ORBIS_MEDIA) return json({ error: "Хранилище медиа ещё не подключено. Нужен R2 bucket ORBIS_MEDIA." }, 503);
    const form = await request.formData();
    const files = form.getAll("files").filter(value => value && typeof value === "object" && typeof value.size === "number");
    if (!files.length || files.length > 4) return json({ error: "Выбери от 1 до 4 файлов." }, 400);
    const allowed = { "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp", "image/gif":"gif", "video/mp4":"mp4", "video/webm":"webm" };
    const uploaded = [];
    for (const file of files) {
      const ext = allowed[file.type];
      const max = file.type.startsWith("video/") ? 50 * 1024 * 1024 : 12 * 1024 * 1024;
      if (!ext) return json({ error: "Поддерживаются JPG, PNG, WebP, GIF, MP4 и WebM." }, 415);
      if (file.size <= 0 || file.size > max) return json({ error: "Файл слишком большой. Фото — до 12 МБ, видео — до 50 МБ." }, 413);
      const key = user.username + "/" + crypto.randomUUID() + "." + ext;
      await env.ORBIS_MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" }, customMetadata: { owner: user.username } });
      uploaded.push({ key, url: "/media/" + key, type: file.type, size: file.size });
    }
    return json({ ok: true, media: uploaded }, 201);
  }
  if (request.method === "GET" && path === "/api/posts") {
    const user = await currentUser(request, env);
    const topic = String(url.searchParams.get("topic") || "").trim().toLocaleLowerCase("ru");
    const query = String(url.searchParams.get("q") || "").trim().toLocaleLowerCase("ru");
    const pageSize = Math.min(30, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0);
    let posts = await allPosts(env, topic || query ? 10000 : pageSize + 1, topic || query ? 0 : offset);
    if (topic) posts = posts.filter(post => String(post.topic || "").toLocaleLowerCase("ru") === topic);
    if (query) posts = posts.filter(post => [post.title, post.body, post.topic, post.author, post.username].join(" ").toLocaleLowerCase("ru").includes(query));
    const hasMore = topic || query ? posts.length > offset + pageSize : posts.length > pageSize;
    posts = topic || query ? posts.slice(offset, offset + pageSize) : posts.slice(0, pageSize);
    const views = await Promise.all(posts.map(post => postView(env, post, user)));
    return json({ posts: views, hasMore, nextOffset: offset + views.length });
  }
  const likeMatch = path.match(/^\/api\/posts\/([a-f0-9-]+)\/like$/i);
  if (request.method === "POST" && likeMatch) {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Войди, чтобы поставить реакцию." }, 401);
    const post = await findPost(env, likeMatch[1]);
    if (!post) return json({ error: "Публикация не найдена." }, 404);
    const key = "like:" + post.id + ":" + user.username;
    const existing = await env.ORBIS_KV.get(key);
    const statsKey = "poststats:" + post.id;
    const stats = await env.ORBIS_KV.get(statsKey, "json") || { likes: 0 };
    const liked = !existing;
    if (liked) {
      await env.ORBIS_KV.put(key, "1");
      stats.likes = Math.max(0, Number(stats.likes || 0) + 1);
    } else {
      await env.ORBIS_KV.delete(key);
      stats.likes = Math.max(0, Number(stats.likes || 0) - 1);
    }
    await env.ORBIS_KV.put(statsKey, JSON.stringify(stats));
    return json({ ok: true, liked, likes: stats.likes });
  }
  const repliesMatch = path.match(/^\/api\/posts\/([a-f0-9-]+)\/replies$/i);
  if (request.method === "GET" && repliesMatch) {
    const parent = await findPost(env, repliesMatch[1]);
    if (!parent) return json({ error: "Публикация не найдена." }, 404);
    const user = await currentUser(request, env);
    const replies = (await allPosts(env, 10000)).filter(post => post.replyTo === parent.id);
    return json({ replies: await Promise.all(replies.map(post => postView(env, post, user))) });
  }
  if (request.method === "POST" && path === "/api/search") {
    if (!await rateLimit(request, env, "search", 40, 60)) return json({ error: "Слишком много поисковых запросов. Попробуй через минуту." }, 429);
    const body = await request.json();
    const q = String(body.q || "").trim().toLocaleLowerCase("ru").slice(0, 80);
    if (q.length < 2) return json({ users: [], posts: [] });
    const [posts, userKeys] = await Promise.all([allPosts(env, 1000), listPrefix(env, "user:", 1000)]);
    const viewer = await currentUser(request, env);
    const matchingUsers = (await Promise.all(userKeys.map(key => env.ORBIS_KV.get(key, "json"))))
      .filter(Boolean)
      .filter(user => [user.username, user.name, user.bio].join(" ").toLocaleLowerCase("ru").includes(q))
      .slice(0, 20);
    const users = await Promise.all(matchingUsers.map(async user => ({
      username: user.username, name: user.name, bio: user.bio,
      isFollowing: viewer ? Boolean(await env.ORBIS_KV.get("follow:" + user.username + ":" + viewer.username)) : false
    })));
    const foundPosts = posts.filter(post => [post.title, post.body, post.topic, post.username, post.author].join(" ").toLocaleLowerCase("ru").includes(q)).slice(0, 30);
    return json({ users, posts: await Promise.all(foundPosts.map(post => postView(env, post, viewer))) });
  }
  const followMatch = path.match(/^\/api\/users\/([a-z0-9_.]{3,24})\/follow$/i);
  if (request.method === "POST" && followMatch) {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Войди, чтобы подписаться." }, 401);
    const target = followMatch[1].toLowerCase();
    if (target === user.username) return json({ error: "Нельзя подписаться на самого себя." }, 400);
    if (!await env.ORBIS_KV.get("user:" + target)) return json({ error: "Пользователь не найден." }, 404);
    const key = "follow:" + target + ":" + user.username;
    const exists = await env.ORBIS_KV.get(key);
    if (exists) await env.ORBIS_KV.delete(key); else await env.ORBIS_KV.put(key, "1");
    return json({ ok: true, following: !exists });
  }
  if (request.method === "POST" && path === "/api/reports") {
    if (!await rateLimit(request, env, "reports", 8, 3600)) return json({ error: "Лимит жалоб на сегодня временно исчерпан." }, 429);
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Войди, чтобы отправить жалобу." }, 401);
    const body = await request.json();
    const postId = String(body.postId || "");
    const reason = String(body.reason || "").trim().slice(0, 300);
    if (!postId || !reason) return json({ error: "Укажи публикацию и причину." }, 400);
    if (!await findPost(env, postId)) return json({ error: "Публикация не найдена." }, 404);
    const reportId = crypto.randomUUID();
    await env.ORBIS_KV.put("report:" + Date.now().toString().padStart(13, "0") + ":" + reportId, JSON.stringify({ id: reportId, postId, reason, reporter: user.username, createdAt: new Date().toISOString(), status: "new" }));
    return json({ ok: true }, 201);
  }
  if (request.method === "POST" && path === "/api/posts") {
    if (!await rateLimit(request, env, "publish", 12, 60)) return json({ error: "Слишком много публикаций подряд. Подожди немного." }, 429);
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Сначала войди в ORBIS." }, 401);
    const body = await request.json();
    const title = String(body.title || "").trim().slice(0, 120);
    const topic = String(body.topic || "").trim().slice(0, 48);
    const text = String(body.body || "").trim().slice(0, 4000);
    if (!title || !topic || !text) return json({ error: "Заполни название, тему и текст публикации." }, 400);
    const media = Array.isArray(body.media) ? body.media.slice(0, 4) : [];
    if (body.media && (!Array.isArray(body.media) || body.media.length > 4)) return json({ error: "Можно прикрепить не более 4 файлов." }, 400);
    for (const item of media) {
      if (!item || typeof item.key !== "string" || !item.key.startsWith(user.username + "/") || !await env.ORBIS_MEDIA?.head(item.key)) return json({ error: "Один из медиафайлов не найден или недоступен." }, 400);
    }
    const replyTo = String(body.replyTo || "").trim();
    let parentPost = null;
    if (replyTo) {
      parentPost = await findPost(env, replyTo);
      if (!parentPost) return json({ error: "Исходная публикация не найдена." }, 404);
    }
    const post = { id: crypto.randomUUID(), title, topic, body: text, username: user.username, author: user.name, createdAt: new Date().toISOString(), replyTo: replyTo || null, replyToTitle: parentPost?.title || null, media };
    const mediaLinks = media.map(item => url.origin + item.url).join("\n");
    const archiveText = ("ORBIS · " + (replyTo ? "ОТВЕТ-ПУБЛИКАЦИЯ" : "НОВАЯ ПУБЛИКАЦИЯ") + "\n" + title + "\nТема: " + topic + "\nАвтор: @" + user.username + (replyTo ? "\nОтвет на: " + parentPost.title + " (" + replyTo + ")" : "") + "\n\n" + text + (mediaLinks ? "\n\nМедиа:\n" + mediaLinks : "") + "\n\nID: " + post.id).slice(0, 4000);
    // Persist the publication first. Telegram is a secondary archive, so a temporary
    // Telegram outage must never destroy a user's successfully submitted post.
    const storageKey = "post:" + Date.now().toString().padStart(13, "0") + ":" + post.id;
    post.telegramMediaMessageIds = [];
    post.mediaArchived = media.length === 0;
    post.archived = false;
    await env.ORBIS_KV.put(storageKey, JSON.stringify(post));
    await env.ORBIS_KV.put("postid:" + post.id, storageKey);
    await env.ORBIS_KV.put("poststats:" + post.id, JSON.stringify({ likes: 0 }));
    try {
      if (!env.BOT_TOKEN || !env.POSTS_CHANNEL_ID) throw new Error("Не настроены BOT_TOKEN и POSTS_CHANNEL_ID.");
      const archived = await telegram("sendMessage", env, { chat_id: env.POSTS_CHANNEL_ID, text: archiveText, disable_web_page_preview: true });
      post.telegramMessageId = archived.result.message_id;
      post.archived = true;
      const mediaChannel = env.MEDIA_CHANNEL_ID || env.POSTS_CHANNEL_ID;
      for (const item of media) {
        const mediaUrl = url.origin + item.url;
        const caption = ("ORBIS · @" + user.username + "\n" + title + "\n" + post.id).slice(0, 900);
        const method = item.type === "image/gif" ? "sendAnimation" : item.type.startsWith("video/") ? "sendVideo" : "sendPhoto";
        const field = item.type === "image/gif" ? "animation" : item.type.startsWith("video/") ? "video" : "photo";
        try {
          const mediaResult = await telegram(method, env, { chat_id: mediaChannel, [field]: mediaUrl, caption });
          post.telegramMediaMessageIds.push(mediaResult.result.message_id);
        } catch (mediaError) {
          post.mediaArchiveWarning = "Медиа доступно в ORBIS, но Telegram не смог скопировать его в медиаканал: " + mediaError.message;
        }
      }
      post.mediaArchived = post.telegramMediaMessageIds.length === media.length;
    } catch (error) {
      post.archiveWarning = "Публикация сохранена в ORBIS, но Telegram-архив временно недоступен: " + error.message;
    }
    await env.ORBIS_KV.put(storageKey, JSON.stringify(post));
    if (env.INDEX_CHANNEL_ID) {
      try {
        await telegram("sendMessage", env, { chat_id: env.INDEX_CHANNEL_ID, text: "ORBIS_INDEX\n" + post.createdAt + "\n@" + post.username + "\n" + post.topic + "\n" + post.id, disable_web_page_preview: true });
        post.indexed = true;
        await env.ORBIS_KV.put(storageKey, JSON.stringify(post));
      } catch { post.indexed = false; }
    }
    return json({ ok: true, post: await postView(env, post, user), mediaArchived: post.mediaArchived !== false, archiveWarning: post.archiveWarning || post.mediaArchiveWarning || null }, 201);
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
    const posts = (await allPosts(env, 10000)).filter(post => post.username === username);
    const [followers, following] = await Promise.all([listPrefix(env, "follow:" + username + ":", 10000), listPrefix(env, "follow:", 10000)]);
    const viewer = await currentUser(request, env);
    return json({ user: { username, name: user.name, bio: user.bio, createdAt: user.createdAt }, posts: await Promise.all(posts.map(post => postView(env, post, viewer))), followers: followers.length, following: following.filter(key => key.endsWith(":" + username)).length, isFollowing: viewer ? Boolean(await env.ORBIS_KV.get("follow:" + username + ":" + viewer.username)) : false });
  }
  if (request.method === "GET" && path === "/api/news/sources") {
    return json({ sources: Object.entries(NEWS_SOURCES).map(([id, source]) => ({ id, name: source.name, language: source.language, credit: source.credit })) });
  }
  if (request.method === "GET" && path === "/api/news") {
    if (!await rateLimit(request, env, "news", 20, 60)) return json({ error: "Слишком много запросов к новостям. Попробуй через минуту." }, 429);
    const id = String(url.searchParams.get("source") || "bbc-ru");
    const source = NEWS_SOURCES[id];
    if (!source) return json({ error: "Неизвестный новостной источник." }, 404);
    const cacheKey = "news-cache:" + id;
    if (!source.noCache) {
      const cached = await env.ORBIS_KV.get(cacheKey, "json");
      if (cached && Date.now() - cached.fetchedAt < 300000) return json({ source: source.name, language: source.language, items: cached.items, cached: true, fetchedAt: cached.fetchedAt });
    }
    try {
      const response = await fetch(source.url, { headers: { "accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5", "user-agent": "ORBIS News Reader/1.0" } });
      if (!response.ok) throw new Error("Источник ответил HTTP " + response.status);
      const xml = await response.text();
      if (!xml || !/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error("Источник вернул неизвестный формат ленты.");
      const items = parseNewsXml(xml, source, 30);
      if (!items.length) throw new Error("В ленте пока нет доступных публикаций.");
      const fetchedAt = Date.now();
      if (!source.noCache) await env.ORBIS_KV.put(cacheKey, JSON.stringify({ fetchedAt, items }), { expirationTtl: 300 });
      return json({ source: source.name, language: source.language, items, cached: false, fetchedAt });
    } catch (error) {
      const cached = !source.noCache ? await env.ORBIS_KV.get(cacheKey, "json") : null;
      if (cached && cached.items && cached.items.length) return json({ source: source.name, language: source.language, items: cached.items, cached: true, stale: true, warning: "Не удалось обновить источник. Показаны последние сохранённые заголовки.", fetchedAt: cached.fetchedAt });
      return json({ error: "Не удалось загрузить " + source.name + ": " + error.message }, 502);
    }
  }
  if (request.method === "GET" && path === "/api/navigator") {
    const posts = await allPosts(env, 10000);
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
    if (url.pathname.startsWith("/media/")) {
      try {
        if (!env.ORBIS_MEDIA) return new Response("Media storage is not configured", { status: 503 });
        const key = decodeURIComponent(url.pathname.slice("/media/".length));
        if (!/^[a-z0-9_.-]{3,24}\/[a-f0-9-]+\.(jpg|png|webp|gif|mp4|webm)$/i.test(key)) return new Response("Not found", { status: 404 });
        const object = await env.ORBIS_MEDIA.get(key);
        if (!object) return new Response("Not found", { status: 404 });
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("content-length", String(object.size));
        headers.set("cache-control", "public, max-age=31536000, immutable");
        headers.set("x-content-type-options", "nosniff");
        return new Response(request.method === "HEAD" ? null : object.body, { headers });
      } catch (error) { return new Response("Media unavailable", { status: 500 }); }
    }
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
