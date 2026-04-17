# Load Testing — k6

Performance guard for critical edge functions. Detects P95/P99 regression, error-rate spikes, and throughput limits **before** production.

## Critical endpoint

| Function | Why critical |
|----------|--------------|
| `llm-gateway` | Hot path for every chat/agent run. Latency directly impacts UX. |

## Prerequisites

Install k6: <https://grafana.com/docs/k6/latest/set-up/install-k6/>

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

Set env vars (export before run):

```bash
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_ANON_KEY="eyJ..."
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."   # required — bypass user quota
```

## Run

```bash
# Smoke test — 1 VU, 30s (sanity check, ~10–30 requests)
npm run test:load:smoke

# Full load — ramp 0→20 VUs in 1m, sustain 3m, ramp-down 30s (~3000 requests)
npm run test:load
```

## Thresholds (any breach = exit code 1)

| Metric | Limit | Rationale |
|--------|-------|-----------|
| `http_req_duration p(95)` | < 2000 ms | UX-tolerable latency for chat |
| `http_req_duration p(99)` | < 5000 ms | Tail latency cap |
| `http_req_failed rate` | < 1 % | Resilience floor |
| `checks rate` | > 95 % | Body validity floor |
| `llm_gateway_success rate` | > 95 % | Endpoint-specific success |

## Reading the output

```
✓ status is 200 or 4xx
✓ response under 5s
✓ has body

http_req_duration..............: p(95)=1.8s p(99)=3.2s   ← below threshold ✅
http_req_failed................: 0.42%                    ← below 1% ✅
checks.........................: 99.1%                    ← above 95% ✅
```

**Failure example:**
```
✗ http_req_duration p(95)<2000 → 2841ms (FAILED)
```
→ investigate edge function: cold-start, downstream API throttling, DB lock.

## Calibrating thresholds

Re-baseline after major infra changes (instance upgrade, DB index, model swap):

1. Run full load 3× on a quiet day.
2. Take median of P95 + 20% headroom = new threshold.
3. Update `options.thresholds` in `llm-gateway.k6.js`.
4. Document the bump in `RUNBOOK.md` + commit message.

## Output artifacts

- `summary.json` — machine-readable metrics (uploaded as CI artifact)
- stdout — human summary table
