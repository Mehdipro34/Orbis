const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

async function rateLimit(request, env, action, limit, windowSeconds) {
  if (!env.ORBIS_KV) return false;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = "ratelimit:" + action + ":" + ip;
  const now = Date.now();
  let state = await env.ORBIS_KV.get(key, "json");
  if (!state || now - Number(state.startedAt || 0) >= windowSeconds * 1000) state = { startedAt: now, count: 0 };
  state.count = Number(state.count || 0) + 1;
  await env.ORBIS_KV.put(key, JSON.stringify(state), { expirationTtl: windowSeconds });
  return state.count <= limit;
}

const NEWS_SOURCES = {
  "bbc-ru": { name: "BBC News · Русский", url: "https://feeds.bbci.co.uk/russian/rss.xml", language: "Русский", credit: "BBC News", allowedHosts: ["bbc.com", "bbc.co.uk"] },
  "oxu-az": { name: "Oxu.az", url: "https://oxu.az/feed", language: "Азербайджанский", credit: "Oxu.az", allowedHosts: ["oxu.az"] },
  "bbc-world": { name: "BBC News · Мир", url: "https://feeds.bbci.co.uk/news/world/rss.xml", language: "English", credit: "BBC News", allowedHosts: ["bbc.com", "bbc.co.uk"] },
  "aljazeera-en": { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", language: "English", credit: "Al Jazeera", allowedHosts: ["aljazeera.com"] }
};

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g, "$1")
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code) => {
      const n = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      try { return Number.isFinite(n) ? String.fromCodePoint(n) : ""; } catch { return ""; }
    })
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim();
}

function xmlTag(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp("<" + name + "(?:\\\\s[^>]*)?>([\\\\s\\\\S]*?)</" + name + "\\\\s*>", "i"));
    if (match) return decodeXml(match[1]);
  }
  return "";
}

function parseNewsXml(xml, source, limit = 30) {
  const blocks = [...xml.matchAll(/<(item|entry)(?:\\s[^>]*)?>([\\s\\S]*?)<\\/\\1\\s*>/gi)].map(match => match[2]);
  const entries = [];
  for (const block of blocks.slice(0, limit)) {
    const title = xmlTag(block, ["title"]);
    let link = xmlTag(block, ["link"]);
    if (!link) {
      const linkMatch = block.match(/<link\\b[^>]*href=["\\']([^"\\']+)["\\'][^>]*\\/?\\s*>/i);
      if (linkMatch) link = decodeXml(linkMatch[1]);
    }
    const description = xmlTag(block, ["description", "summary", "content:encoded", "content"]);
    const dateText = xmlTag(block, ["pubDate", "published", "updated", "dc:date"]);
    let safeUrl = "";
    try {
      const parsed = new URL(link);
      const allowed = source.allowedHosts.some(host => parsed.hostname === host || parsed.hostname.endsWith("." + host));
      if (parsed.protocol === "https:" && allowed) safeUrl = parsed.href;
    } catch {}
    if (!title || !safeUrl) continue;
    entries.push({
      title: title.slice(0, 220),
      summary: description.slice(0, 260),
      url: safeUrl,
      publishedAt: dateText && !Number.isNaN(Date.parse(dateText)) ? new Date(dateText).toISOString() : null,
      source: source.name,
      credit: source.credit
    });
  }
  return entries;
}

async function api(request, env, url) {
  const path = url.pathname;
  if (request.method === "GET" && path === "/api/news/sources") {
    return json({ sources: Object.entries(NEWS_SOURCES).map(([id, source]) => ({ id, name: source.name, language: source.language, credit: source.credit })) });
  }
  if (request.method === "GET" && path === "/api/news") {
    if (!env.ORBIS_KV) return json({ error: "Новостной кеш ORBIS_KV ещё не подключён." }, 503);
    if (!await rateLimit(request, env, "news", 20, 60)) return json({ error: "Слишком много запросов к новостям. Попробуй позже." }, 429);
    const id = String(url.searchParams.get("source") || "bbc-ru");
    const source = NEWS_SOURCES[id];
    if (!source) return json({ error: "Неизвестный новостной источник." }, 404);
    const cacheKey = "news-cache:" + id;
    const cached = await env.ORBIS_KV.get(cacheKey, "json");
    if (cached && Date.now() - cached.fetchedAt < 300000) {
      return json({ source: source.name, language: source.language, items: cached.items, cached: true, fetchedAt: cached.fetchedAt });
    }
    try {
      const response = await fetch(source.url, {
        headers: {
          "accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
          "user-agent": "ORBIS News Reader/1.0"
        }
      });
      if (!response.ok) throw new Error("Источник ответил HTTP " + response.status);
      const xml = await response.text();
      if (!xml || !/<(?:rss|feed|rdf:RDF)\\b/i.test(xml)) throw new Error("Источник вернул неизвестный формат ленты.");
      const items = parseNewsXml(xml, source, 30);
      if (!items.length) throw new Error("В ленте пока нет доступных публикаций.");
      const fetchedAt = Date.now();
      await env.ORBIS_KV.put(cacheKey, JSON.stringify({ fetchedAt, items }), { expirationTtl: 300 });
      return json({ source: source.name, language: source.language, items, cached: false, fetchedAt });
    } catch (error) {
      if (cached?.items?.length) {
        return json({
          source: source.name, language: source.language, items: cached.items, cached: true, stale: true,
          warning: "Не удалось обновить источник. Показаны последние сохранённые заголовки.",
          fetchedAt: cached.fetchedAt
        });
      }
      return json({ error: "Не удалось загрузить " + source.name + ": " + error.message }, 502);
    }
  }
  return json({ error: "Основной ORBIS API работает через Supabase." }, 410);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") && !["/api/news", "/api/news/sources"].includes(url.pathname)) {
      return json({ error: "Основной ORBIS API работает через Supabase. Обнови приложение и повтори запрос." }, 410);
    }
    if (url.pathname.startsWith("/api/")) {
      try { return await api(request, env, url); }
      catch (error) { return json({ error: "Ошибка новостного сервиса ORBIS. " + error.message }, 500); }
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "orbissocial", version: "0.3.0", api: "Supabase" });
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ app: "ORBIS", status: "online", version: "0.3.0" });
  }
};
