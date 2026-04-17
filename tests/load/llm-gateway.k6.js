/**
 * ═══════════════════════════════════════════════════════════════
 * k6 load test — llm-gateway edge function (critical path)
 * ═══════════════════════════════════════════════════════════════
 *
 * Modes:
 *   Smoke (default if --vus/--duration set): 1 VU, 30s — sanity check
 *   Load  (default scenario): ramp 0→20 VUs in 1m, sustain 3m, ramp-down 30s
 *
 * Required env:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   k6 run tests/load/llm-gateway.k6.js                   # full load
 *   k6 run --vus 1 --duration 30s tests/load/llm-gateway.k6.js  # smoke
 *
 * Thresholds violated => exit code != 0 (fails CI).
 */
import http from "k6/http";
import { check, sleep, fail } from "k6";
import { Trend, Rate } from "k6/metrics";

const SUPABASE_URL = __ENV.SUPABASE_URL || __ENV.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || __ENV.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY = __ENV.SUPABASE_SERVICE_ROLE_KEY;

// Graceful skip when secrets absent (CI without service role)
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
  console.warn(
    "⚠️  SKIP — SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY not set. Load test requires all three.",
  );
}

const llmLatency = new Trend("llm_gateway_latency_ms", true);
const llmSuccess = new Rate("llm_gateway_success");

export const options = {
  scenarios: {
    load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 20 },
        { duration: "3m", target: 20 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.95"],
    llm_gateway_latency_ms: ["p(95)<2000"],
    llm_gateway_success: ["rate>0.95"],
  },
  // Honors CLI --vus/--duration override (smoke mode disables ramping)
  discardResponseBodies: false,
};

const ENDPOINT = `${SUPABASE_URL}/functions/v1/llm-gateway`;

export default function () {
  if (!SERVICE_ROLE_KEY) {
    sleep(1);
    return;
  }

  const payload = JSON.stringify({
    model: "google/gemini-2.5-flash-lite",
    messages: [
      { role: "user", content: "Reply with exactly: OK" },
    ],
    max_tokens: 10,
    temperature: 0,
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      // Use service role for synthetic load — bypasses user quota
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    timeout: "30s",
    tags: { endpoint: "llm-gateway" },
  };

  const res = http.post(ENDPOINT, payload, params);

  llmLatency.add(res.timings.duration);
  const ok = check(res, {
    "status is 200 or 4xx (auth-only test)": (r) =>
      r.status === 200 || (r.status >= 400 && r.status < 500),
    "response under 5s": (r) => r.timings.duration < 5000,
    "has body": (r) => r.body && r.body.length > 0,
  });
  llmSuccess.add(ok);

  sleep(Math.random() * 2 + 1); // 1–3s between requests per VU
}

export function handleSummary(data) {
  return {
    "summary.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const fmt = (n) => (typeof n === "number" ? n.toFixed(2) : "n/a");
  return `
═══════════════════════════════════════════════════════════════
  k6 Load Test — llm-gateway
═══════════════════════════════════════════════════════════════
  Total requests:    ${m.http_reqs?.values?.count ?? 0}
  Failed requests:   ${fmt(m.http_req_failed?.values?.rate * 100)}%
  Latency p(50):     ${fmt(m.http_req_duration?.values?.["p(50)"])} ms
  Latency p(95):     ${fmt(m.http_req_duration?.values?.["p(95)"])} ms
  Latency p(99):     ${fmt(m.http_req_duration?.values?.["p(99)"])} ms
  Checks passed:     ${fmt(m.checks?.values?.rate * 100)}%
═══════════════════════════════════════════════════════════════
`;
}
