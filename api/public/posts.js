"use strict";

const SUPABASE_URL = "https://wdwvcvpgovvkoodozbxf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_B-88igN5GVsuj67o-vtCVA_--RFWsLx";

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const mode = String(req.query.mode || "latest");
  const limit = Math.max(1, Math.min(30, Number(req.query.limit) || 20));
  const cursor = String(req.query.cursor || "");
  if (!["latest", "popular"].includes(mode)) {
    return res.status(400).json({ error: "Unsupported feed mode." });
  }
  if (cursor.length > 700) {
    return res.status(400).json({ error: "Invalid feed cursor." });
  }

  const params = new URLSearchParams({ limit: String(limit), mode });
  if (cursor) params.set("cursor", cursor);

  try {
    const upstream = await fetch(
      SUPABASE_URL + "/functions/v1/orbis-api/api/public/posts?" + params.toString(),
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          accept: "application/json"
        },
        signal: AbortSignal.timeout(12000)
      }
    );

    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(upstream.status).json(payload);
    }

    // Only public, non-personalised feed pages are CDN-cacheable.
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.setHeader("CDN-Cache-Control", "public, max-age=60");
    res.setHeader("Vary", "Accept-Encoding");
    res.setHeader("X-ORBIS-Feed-Cache", "public-60s");
    return res.status(200).json(payload);
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ error: "Public feed is temporarily unavailable." });
  }
};
