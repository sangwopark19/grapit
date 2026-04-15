# Phase 09.1 — Post-cleanup CI verification

**CI run URL:** https://github.com/sangwopark19/grapit/actions/runs/24440970303
**Commit SHA (post-cleanup):** c57421d (docs(09.1): close Phase 09 deferred CI-login-E2E + record cleanup verification)
**Compare to:** artifacts/ci-12-12-green.md (pre-cleanup baseline, run 24440704025)

| Step | Pre-cleanup | Post-cleanup |
|------|-------------|--------------|
| lint | ✓ | ✓ |
| typecheck | ✓ | ✓ |
| test (unit, api 172 / web 95) | ✓ | ✓ |
| DB migrations | ✓ | ✓ |
| Seed test data | ✓ | ✓ |
| Verify Toss test secrets | ✓ | ✓ |
| Build API | ✓ | ✓ |
| Start API server | ✓ | ✓ |
| Smoke test login (curl) | HTTP 200 | HTTP 200 |
| E2E tests (Toss Payments) | 12 passed (+1 probe = 13) | **12 passed** |
| (removed) Record runtime versions | existed | removed ✓ |
| (removed) Dump AUTH_LOGIN_DEBUG | existed | removed ✓ |
| (removed) E2E diagnostic probe | existed | removed ✓ |
| Workflow status | success | **success** |
| Total job steps | 23 | **20** (3 step 제거 일치) |

**Conclusion:** Cleanup introduced 0 regressions. Phase 09.1 goal fully achieved with no diagnostic code remaining.

## 5 신호 최종 상태 (post-cleanup)

| Signal | Status | Note |
|--------|--------|------|
| S1 (server-side req 정상) | ✓ (Plan 04 evidence, 진단 인프라 제거 후 더 이상 직접 관찰 불가) | fix-verification.md + ci-12-12-green.md |
| S2 (wire header 정합) | ✓ (Plan 02/04 evidence) | diff.md (before) + fix-verification.md (after) |
| S3 (response body 정상) | ✓ (Plan 04 evidence) | probe spec status=200 + accessToken |
| S4 (E2E 12/12 green) | ✓ (영구 — 매 main push 마다 검증) | **이 문서 — 12 passed in cleanup CI** |
| S5 (curl regression 0) | ✓ (영구) | **이 문서 — Smoke test login HTTP 200** |
