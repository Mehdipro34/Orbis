const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function telegram(method, env, payload) {
  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(`Telegram API error: ${result.description || response.status}`);
  }
  return result;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({ app: "ORBIS", status: "online", version: "0.1.0" });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "orbissocial" });
    }

    if (request.method === "POST" && url.pathname === "/setup") {
      if (!env.WEBHOOK_SECRET || request.headers.get("x-orbis-setup") !== env.WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }
      if (!env.BOT_TOKEN) return json({ ok: false, error: "BOT_TOKEN is not configured" }, 500);

      const webhookUrl = `${url.origin}/telegram`;
      const result = await telegram("setWebhook", env, {
        url: webhookUrl,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ["message", "channel_post"]
      });
      return json({ ok: true, webhook: webhookUrl, telegram: result.result });
    }

    if (request.method === "POST" && url.pathname === "/telegram") {
      if (!env.WEBHOOK_SECRET ||
          request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      let update;
      try {
        update = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON" }, 400);
      }

      const message = update.message || update.channel_post;
      if (message?.text === "/orbis_test" && message.chat?.id) {
        await telegram("sendMessage", env, {
          chat_id: message.chat.id,
          text: "ORBIS подключён к Telegram. API работает."
        });
      }

      return new Response("OK");
    }

    return json({ ok: false, error: "Not found" }, 404);
  }
};
