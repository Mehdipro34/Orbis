import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const failures = new Rate("orbis_public_feed_failures");
const latency = new Trend("orbis_public_feed_latency_ms");
const target = (__ENV.ORBIS_BASE_URL || "").replace(/\/$/, "");
const maxVUs = Number(__ENV.MAX_VUS || 10);
const confirmHighLoad = __ENV.CONFIRM_HIGH_LOAD === "YES";

if (!target) throw new Error("Set ORBIS_BASE_URL to a staging deployment URL.");
if (!Number.isInteger(maxVUs) || maxVUs < 1 || maxVUs > 100000) throw new Error("MAX_VUS must be an integer from 1 to 100000.");
if (maxVUs > 100 && !confirmHighLoad) throw new Error("For MAX_VUS > 100, set CONFIRM_HIGH_LOAD=YES after obtaining approval and using a dedicated staging project.");
if (maxVUs > 1000 && !/staging|loadtest|preview/i.test(target)) throw new Error("MAX_VUS > 1000 is allowed only against a staging/preview hostname.");

export const options = {
  scenarios: {
    public_feed: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: Math.min(10, maxVUs) },
        { duration: "45s", target: Math.min(25, maxVUs) },
        { duration: "45s", target: Math.min(50, maxVUs) },
        { duration: "60s", target: maxVUs },
        { duration: "60s", target: maxVUs },
        { duration: "30s", target: 0 }
      ],
      gracefulRampDown: "15s"
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
    orbis_public_feed_failures: ["rate<0.01"],
    orbis_public_feed_latency_ms: ["p(95)<1500"]
  }
};

export default function () {
  const response = http.get(target + "/api/public/posts?mode=latest&limit=20", {
    headers: { Accept: "application/json" },
    tags: { endpoint: "public-feed" }
  });
  latency.add(response.timings.duration);
  const ok = check(response, {
    "public feed returns 200": (r) => r.status === 200,
    "public feed contains a posts array": (r) => {
      try { return Array.isArray(r.json("posts")); } catch { return false; }
    },
    "public feed response is not personalised": (r) => {
      try {
        const posts = r.json("posts") || [];
        return posts.every((post) => !("isFollowing" in post));
      } catch { return false; }
    }
  });
  failures.add(!ok);
  // Keep the read-only staging probe gentle. Shared CDN cache should absorb repeat requests.
  sleep(1);
}
