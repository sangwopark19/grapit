---
phase: 09-tech-debt
plan: 03
subsystem: payment-e2e-ci
tags: [toss-payments, playwright, e2e, ci, debt-05, high-01, high-02, blocker-b1, blocker-b2]
requires: ["09-01", "09-02"]
provides:
  - apps/web/e2e/toss-payment.spec.ts
  - apps/web/e2e/fixtures/booking-store.ts
  - apps/web/e2e/helpers/auth.ts
  - apps/web/stores/use-booking-store.ts (extended)
  - apps/web/playwright.config.ts (extended)
  - .env.example (extended)
  - .github/workflows/ci.yml (extended)
affects:
  - Toss Payments SDK integration (real sandbox key → CI verification)
  - AuthGuard-protected booking pages (/confirm, /complete)
  - booking store (dev/test-only fixture hook, production tree-shake preserved)
  - CI pipeline (adds hard-gate + E2E step without touching deploy.yml)
tech-stack:
  added: []
  patterns:
    - "Playwright `test.skip(condition)` as env-gated safety net for missing CI secrets"
    - "`page.route('**/api/v1/payments/confirm')` intercept for DEBT-05 closure assertion"
    - "window.__BOOKING_FIXTURE__ + queueMicrotask fixture hook gated by NODE_ENV"
    - "page.request.post('/api/v1/auth/login') with shared storage state for AuthGuard bypass"
    - "GitHub Actions fork detection: `github.event.pull_request.head.repo.full_name == github.repository`"
key-files:
  created:
    - apps/web/e2e/toss-payment.spec.ts
    - apps/web/e2e/fixtures/booking-store.ts
    - apps/web/e2e/helpers/auth.ts
  modified:
    - apps/web/stores/use-booking-store.ts
    - apps/web/playwright.config.ts
    - .env.example
    - .github/workflows/ci.yml
decisions:
  - "Hybrid E2E strategy (D-14): real Toss SDK load + widget iframe mount assertion, but confirm API is intercepted via page.route because Toss sandbox iframe is cross-origin (PCI)."
  - "Auth helper landed only refreshToken cookie (no localStorage seed) because useAuthStore does NOT use zustand persist — AuthInitializer exchanges the cookie for accessToken on first render via /api/v1/auth/refresh."
  - "Did not attempt to automate Toss sandbox card-input iframe — PCI boundary (Pitfall 3). Happy path asserts widget mount + intercept only."
  - "deploy.yml left untouched to enforce D-13 key isolation — TOSS_CLIENT_KEY_TEST / TOSS_SECRET_KEY_TEST exist only in ci.yml + .env.example."
metrics:
  duration: ~35 minutes (agent time, parallel wave)
  completed: "2026-04-14"
  commits: 5 (code) + 1 (SUMMARY)
---

# Phase 9 Plan 03: Toss Payments E2E CI (DEBT-05) Summary

One-liner: Playwright E2E with real Toss SDK widget mount assertion + confirm API interception closes DEBT-05, gated by CI hard-fail secrets check that keeps test keys out of production deploy.yml.

## Deliverables

| File | Change | Purpose |
|------|--------|---------|
| `apps/web/e2e/toss-payment.spec.ts` | created (166 lines) | 3 scenarios: happy path (DEBT-05 closure evidence) + cancel/decline UI regression |
| `apps/web/e2e/fixtures/booking-store.ts` | created | `injectBookingFixture(page, args)` with SeatSelection[] shape (Blocker B1) |
| `apps/web/e2e/helpers/auth.ts` | created | `loginAsTestUser(page)` via POST /api/v1/auth/login + refreshToken cookie propagation (Blocker B2) |
| `apps/web/stores/use-booking-store.ts` | extended +45 lines | `__BOOKING_FIXTURE__` hook, queueMicrotask, NODE_ENV !== 'production' gate |
| `apps/web/playwright.config.ts` | extended +8 lines | `webServer.env.NEXT_PUBLIC_TOSS_CLIENT_KEY` fallback chain |
| `.env.example` | extended +16 lines | Toss test key aliases + TEST_USER_* fallback docs + "NEVER in deploy.yml" comment |
| `.github/workflows/ci.yml` | extended +36 lines | verify-toss-secrets hard-gate + Playwright install + E2E step + TEST_USER_* env |

## Commits

| Hash | Task | Description |
|------|------|-------------|
| cfbeb4e | 0 | `test(09-tech-debt): add Toss E2E spec + fixture + auth helper (DEBT-05, HIGH-01, B1, B2)` |
| 07bdfbd | 1 | `feat(09-tech-debt): add Toss test key aliases + TEST_USER_* fallback hints to .env.example (DEBT-05, B2)` |
| 545b1b4 | 2 | `feat(09-tech-debt): add booking store fixture hook for E2E (DEBT-05, HIGH-01, B1)` |
| b3e4f56 | 3 | `feat(09-tech-debt): propagate Toss test key to Playwright dev server env (DEBT-05)` |
| 44774b6 | 4 | `feat(09-tech-debt): add Toss E2E step + secrets hard-gate + TEST_USER_* env in CI (DEBT-05, HIGH-02, B2)` |

## DEBT-05 Closure Evidence (REVIEWS.md HIGH-01)

### Happy Path Scenario (Scenario 1)

Preconditions:
1. `loginAsTestUser(page)` — real POST /api/v1/auth/login lands httpOnly `refreshToken` cookie; AuthInitializer exchanges for accessToken on first render (AuthGuard unblocks).
2. `page.route('**/api/v1/payments/confirm')` intercept registered before any navigation; fulfilled with 200 + ReservationDetail-shaped body (SeatSelection[] seats).
3. `injectBookingFixture(page, { seats: SeatSelection[] … })` via `addInitScript` writes `window.__BOOKING_FIXTURE__`; the dev-only store hook reads it on client init and calls `setBookingData`.

Flow:
4. `page.goto('/booking/:id/confirm')`.
5. Assert URL contains `/confirm` (no redirect to `/booking/:id` or `/auth`).
6. `expect(page.locator('#payment-method iframe')).toBeVisible({ timeout: 20000 })` — real Toss SDK load evidence.
7. `page.goto('/booking/:id/complete?paymentKey=…&orderId=…&amount=…')` to simulate successUrl redirect.
8. `expect.poll(() => confirmIntercepted, { timeout: 10000 }).toBe(true)` — strict true assertion (not typeof-only).
9. `expect(page.getByText(/예매가 완료|완료되었습니다/)).toBeVisible()` — BookingComplete renders.

Static verification log (all 16 grep-driven acceptance criteria passed):

```
1 OK: test.skip
2 OK: TOSS_CLIENT_KEY_TEST
3 OK: confirmIntercepted assert (expect.poll)
4 OK: widget mount assert (#payment-method iframe)
5 OK: loginAsTestUser
6 OK: seatId
7 OK: tierName
8 OK: no grade: key
9 OK: no label: key
10 OK: no frameLocator toss
11 OK: no TOSS_SECRET_KEY_TEST in spec
12 OK: SeatSelection in fixture
13 OK: page.request.post
14 OK: TEST_USER_EMAIL in helper
15 OK: TestAdmin2026 fallback
16 OK: UI regression comment
```

Build & type health:
- `pnpm --filter @grapit/web typecheck` exits 0 (all 4 modified files + 3 new files type-safe)
- `pnpm --filter @grapit/web build` exits 0 (12 routes prerendered, no bundle warnings from fixture hook — NODE_ENV !== 'production' gate tree-shook in prod)
- `pnpm --filter @grapit/web lint` exits 0 errors + 18 pre-existing warnings (none in files modified by this plan)
- `playwright test toss-payment --list` reports 3 tests in 1 file (spec parses cleanly)

## REVIEWS.md Response Evidence

### HIGH-01 — DEBT-05 actually closed

| Criterion | Evidence |
|-----------|----------|
| Widget iframe mount asserted | `page.locator('#payment-method iframe')` at toss-payment.spec.ts:95 |
| confirmIntercepted strict === true | `expect.poll(() => confirmIntercepted, { timeout: 10000 }).toBe(true)` at spec:108-111 |
| Cancel/Decline labeled "UI regression" | Spec comments at lines 117-124 and 142-148 (+ objective disclaimer) |

### HIGH-02 — CI secrets hard-gate

| Criterion | Evidence |
|-----------|----------|
| Gate on push/schedule/workflow_dispatch | ci.yml:29-31 (event_name check) |
| Same-repo PR also gated | ci.yml:32 (`head.repo.full_name == github.repository`) |
| Fork PR skips gracefully | Same check — fork PRs fail the condition and skip, no exit 1 |
| exit 1 on missing secrets | ci.yml:41 |
| workflow_dispatch trigger added | ci.yml:7 (allows manual drill for gate testing) |

### MED — expected-absence grep pattern

All negative assertions use `! grep -q …` or `test "$(grep -c … | tr -d ' ')" = "0"`:
- Spec negative checks use `! grep -q`
- deploy.yml isolation uses `test "$(grep -c … | tr -d ' ')" = "0"` (ci.yml acceptance criterion + manual verification passed with count 0)

### LOW — 6 vs 12 debt items

Plan objective first line clarifies "6건 중 1건(DEBT-05)".

## Revision-2 Blocker Closure Evidence

### Blocker B1 — SeatSelection shape

grep counts on `seatId|tierName`:
- apps/web/e2e/toss-payment.spec.ts: 4 matches (fixture arg + intercept body, in 3 tests)
- apps/web/e2e/fixtures/booking-store.ts: 1 match (SeatSelection import declaration in generic)
- apps/web/stores/use-booking-store.ts: 7 matches (SeatSelection in existing interface definitions + new fixture block)

Negative grep (must be 0):
- `grep -qE "grade:\s*'" apps/web/e2e/toss-payment.spec.ts` → 0 (asserted via `!`)
- `grep -qE "label:\s*'" apps/web/e2e/toss-payment.spec.ts` → 0

### Blocker B2 — AuthGuard cookie + no TODO

`apps/web/e2e/helpers/auth.ts`:
- Real `page.request.post('/api/v1/auth/login', …)` at line 34
- Cookie presence verification at lines 48-54 (throws if `refreshToken` cookie missing)
- Fallback credentials `admin@grapit.test` / `TestAdmin2026!` at lines 28-29 (seed.mjs:39-50 defaults)
- **No `page.context().addCookies([])` TODO** (explicit removal of the empty array anti-pattern)

Implementation note: `useAuthStore` in this codebase does NOT use zustand `persist`, so the Plan's hinted `localStorage.setItem('auth-store', …)` would have no effect. Instead, the helper relies on the `AuthInitializer` component (apps/web/components/auth/auth-initializer.tsx), which calls `initializeAuth()` on first render. `initializeAuth` POSTs /api/v1/auth/refresh using the httpOnly `refreshToken` cookie and hydrates the store via `setAuth`. This matches the real user flow and is more reliable than storage-state seeding.

### W1 — SUMMARY is Task 5 deliverable

This file itself closes W1.

## D-13 Key Isolation Audit

```
$ test "$(grep -c 'TOSS_CLIENT_KEY_TEST\|TOSS_SECRET_KEY_TEST' .github/workflows/deploy.yml | tr -d ' ')" = "0"
→ count is 0 ✓
```

`.github/workflows/deploy.yml` was NOT modified by this plan (git log confirms only ci.yml is touched under `.github/workflows/`). Production Cloud Run env remains clean of test keys.

## Deviations from Plan

### Rule 2 (security-adjacent) — auth helper design adjustment

**Trigger:** Plan's step 3 proposed seeding accessToken into `localStorage.setItem('auth-store', …)` via `addInitScript`. Reading `apps/web/stores/use-auth-store.ts` revealed it does NOT use zustand `persist` middleware — the store is purely in-memory and re-initialized on every page load by `AuthInitializer` via `/api/v1/auth/refresh`.

**Fix:** Removed the localStorage seeding (which would have been a no-op) and documented the real path: the refreshToken cookie is the only handle needed — AuthInitializer converts it to an accessToken naturally. This actually matches the real user flow more closely than storage seeding would.

**Files modified:** `apps/web/e2e/helpers/auth.ts` (skipped step 3 from Plan's draft; added docstring explaining the rationale)

**Commit:** cfbeb4e (Task 0)

**Blocker B2 still closed:** Yes — refreshToken cookie presence is still verified; `page.context().addCookies([])` TODO never introduced.

### [Rule 2 — Hygiene] Reverted next-env.d.ts

**Trigger:** `pnpm build` mutates `apps/web/next-env.d.ts` between dev and prod type reference paths. This is purely incidental and reverses on the next dev run.

**Fix:** `git checkout -- apps/web/next-env.d.ts` before committing Task 2 to keep the diff focused.

## Auth Gates Encountered

None — all work completed without user intervention or paid secrets.

## Self-Check: PASSED

Files exist:
- FOUND: apps/web/e2e/toss-payment.spec.ts
- FOUND: apps/web/e2e/fixtures/booking-store.ts
- FOUND: apps/web/e2e/helpers/auth.ts
- FOUND: apps/web/stores/use-booking-store.ts (modified)
- FOUND: apps/web/playwright.config.ts (modified)
- FOUND: .env.example (modified)
- FOUND: .github/workflows/ci.yml (modified)

Commits exist in this worktree branch:
- FOUND: cfbeb4e (Task 0)
- FOUND: 07bdfbd (Task 1)
- FOUND: 545b1b4 (Task 2)
- FOUND: b3e4f56 (Task 3)
- FOUND: 44774b6 (Task 4)

Negative audit:
- PASSED: `grep -c 'TOSS_CLIENT_KEY_TEST\|TOSS_SECRET_KEY_TEST' .github/workflows/deploy.yml` = 0
- PASSED: No `grade:` / `label:` keys in spec fixture payloads (Blocker B1)
- PASSED: No `frameLocator.*toss` in spec (Pitfall 3 — cross-origin not attempted)
- PASSED: No `TOSS_SECRET_KEY_TEST` reference in spec (client bundle safety)

## Deferred Items / Manual Follow-Ups

### Executed in this agent run (automated)

- [x] Code complete: 7 files, 5 commits
- [x] `pnpm --filter @grapit/web typecheck` exits 0
- [x] `pnpm --filter @grapit/web build` exits 0
- [x] `pnpm --filter @grapit/web lint` exits 0 errors (18 pre-existing warnings, all out of scope per CLAUDE.md "fix warnings only in code you changed")
- [x] Playwright spec parses (`playwright test --list` reports 3 tests)
- [x] deploy.yml negative grep = 0 (D-13 preserved)

### Requires local infra (not executable in this agent sandbox)

The following checks need a live DB + API server + outbound network to Toss sandbox and cannot be executed automatically here:

- [ ] **Step 1 (keys UNSET) full run:** `unset TOSS_CLIENT_KEY_TEST; pnpm --filter @grapit/web test:e2e toss-payment` → expected 3 tests skipped, exit 0. Playwright still attempts to boot `pnpm dev` + dependent API server.
- [ ] **Step 2 (keys SET + DB seeded) full run:** expected 3 tests PASS. Requires `pnpm --filter @grapit/api seed` + API running + outbound HTTPS to `https://js.tosspayments.com`.
- [ ] Playwright HTML report screenshot of Scenario 1 widget iframe visible.

The first CI run on `main` push (after merge) will execute both scenarios and is the canonical verification trigger.

### 1-person dev manual checklist (post-merge)

- [ ] `gh secret set TOSS_CLIENT_KEY_TEST --body "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm"`
- [ ] `gh secret set TOSS_SECRET_KEY_TEST --body "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6"`
- [ ] (optional) `gh secret set TEST_USER_EMAIL` / `TEST_USER_PASSWORD` — only if CI DB seeds credentials other than `admin@grapit.test` / `TestAdmin2026!`
- [ ] `gh secret list` shows TOSS_*_TEST (2 or 4 entries)
- [ ] `gcloud run services describe grapit-api --region=asia-northeast3 --format="value(spec.template.spec.containers[0].env[].name)" | grep -E "TOSS_.*_TEST" || echo "OK"` prints "OK" (D-13 production audit)
- [ ] Optional drill: `gh secret delete TOSS_CLIENT_KEY_TEST` then `gh workflow run CI` → verify `verify-toss-secrets` step fails with the expected error message, then re-register the secret.

## Phase 9 Status

- DEBT-01: closed (Plan 01)
- DEBT-02: closed (Plan 02)
- DEBT-03: closed (Plan 02)
- DEBT-04: closed (Plan 02)
- DEBT-05: **closed by this plan (automated CI verification pending first main push)**
- DEBT-06: closed (Plan 01)

Phase 9 code complete. Only operational follow-up remaining: CI secret registration + first green run.

## Next Steps

- Phase 10 (SMS 실연동 via Twilio) planning
