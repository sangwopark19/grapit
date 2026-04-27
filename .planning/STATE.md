---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: 안정화 + 고도화
status: "Phase 15 Wave 1 complete (Plan 01+02) — Plan 03 deferred to post-deploy session"
stopped_at: "Phase 15 Wave 1 — awaiting Plan 01 main merge + Cloud Run deploy before Plan 03 entry"
last_updated: "2026-04-27T05:55:00.000Z"
last_activity: 2026-04-27 — Quick task 260427-kch 핫픽스 (회원가입 410 EXPIRED) — hotfix/main PR #21 대기
progress:
  total_phases: 15
  completed_phases: 10
  total_plans: 56
  completed_plans: 54
  percent: 96
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-09)

**Core value:** 사용자가 원하는 공연을 발견하고, 좌석을 직접 선택하여, 안정적으로 예매를 완료할 수 있는 것
**Current focus:** Phase 15 — Resend heygrabit.com cutover (Wave 1 complete, Wave 2 cutover pending)

## Current Position

Phase: 15 — EXECUTING (Wave 1 complete)
Plan: 2 of 3 complete (15-01 ✅, 15-02 ✅, 15-03 pending)
Status: Awaiting PR merge → Cloud Run deploy → Plan 03 (Secret rotation + UAT + 48h 관측)
Last activity: 2026-04-27 — Plan 15-02 Resend heygrabit.com Verified at 11:41 KST

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 69 (v1.0)
- Average duration: ~10min
- Total execution time: ~3 hours

**By Phase (v1.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation + Auth | 5 | ~57min | ~11min |
| 2. Catalog + Admin | 6 | ~14min | ~2min |
| 3. Seat Map + Real-Time | 4 | N/A | N/A |
| 4. Booking + Payment | 3 | ~16min | ~5min |
| 5. Polish + Launch | 5 | N/A | N/A |
| 07 | 5 | - | - |
| 09.1 | 5 | - | - |
| 10 | 9 | - | - |
| 10.1 | 6 | - | - |
| 11 | 4 | - | - |
| 12 | 6 | - | - |
| 14 | 4 | - | - |

**Recent Trend:**

- v1.0 completed: 27 plans across 5 phases in 13 days
- Trend: Stable

| Phase 06 P01 | 5m | 2 tasks | 12 files |
| Phase 06 P02 | 3m | 1 tasks | 5 files |
| Phase 08 P01 | 1min | 1 tasks | 2 files |
| Phase 08-r2 P02 | 1m | 2 tasks | 3 files |
| Phase 08-r2 P03 | 21min | 2 tasks | 0 files (infra) |

## Accumulated Context

### Roadmap Evolution

- Phase 09.1 inserted after Phase 09: CI-login-E2E — Playwright login helper 의 POST /auth/login 401 이슈 조사 (URGENT)
- Phase 10.1 inserted after Phase 10: SMS API v3 전환 — 2FA PIN API(/2fa/2/pin)에서 일반 SMS API(/sms/3/messages)로 리팩토링, applicationId/messageId 의존 제거, PIN 생성·검증 자체 구현 (URGENT)
- Phase 13 added: 브랜드명 grapit → grabit 일괄 rename (SEED-002 surfaced after Phase 12 ship, 2026-04-22)
- Phase 14 added (2026-04-24): SMS OTP CROSSSLOT fix — Phase 13 UAT Gap test 10. Valkey Cluster mode 에서 sms.service.ts 3개 key 공통 hash tag 없이 EVAL → CROSSSLOT. phone-verification.tsx 가 res.message 를 UX 에서 마스킹하여 "틀린 인증번호" 로 오표시. Reference: .planning/debug/signup-sms-otp-verify-wrong.md + commit b382e39 (booking.service.ts 동일 패턴 선례)
- Phase 15 added (2026-04-24): Resend heygrabit.com cutover — Phase 13 UAT Gap test 9. Plan 03/04 가 명시적으로 deferred 처리한 RESEND_FROM_EMAIL secret 값 교체 + Resend 콘솔 heygrabit.com 도메인 verification + DNS SPF/DKIM/DMARC 후이즈 등록. Reference: .planning/debug/password-reset-email-not-delivered-prod.md
- Phase 16 added (2026-04-24): Legal pages launch — Phase 13 UAT Gap test 11 (pre-existing feature gap). apps/web/app/legal/{terms,privacy,marketing} 신규 구현 + Footer href="#" 플레이스홀더 교체. 한국 개보법·정통망법 상시 공개 URL 런칭 요건. Reference: .planning/debug/legal-pages-404-heygrabit.md
- Phase 17 added (2026-04-24): Local dev health indicator fix — Phase 13 UAT Gap test 1 (pre-existing Phase 7-05 버그). InMemoryRedis mock 에 ping() 미구현 → Terminus 503. InMemoryRedis.ping() 추가 + capability probe. Reference: .planning/debug/local-api-health-503-no-redis.md

### Decisions

Full decision log in PROJECT.md Key Decisions table (10 decisions, all Good).

- [Phase 06]: Guard에서 factory 패턴 대신 개별 클래스 + 공통 헬퍼 함수 패턴으로 NestJS DI 안정성 확보
- [Phase 06]: OAuth provider 봇 감지로 callback URL 직접 접근 방식의 E2E 테스트 구성
- [Phase 08]: S3Client forcePathStyle: true 추가로 R2 path-style URL 호환성 확보
- [Phase 08-r2]: remotePatterns에 spread+조건부 패턴으로 환경변수 미설정 시 빈 배열 유지
- [Phase 08-r2]: R2 credentials를 secrets 섹션에 배치하여 T-08-04 위협 완화

### Pending Todos

None.

### Blockers/Concerns

- ~~AUTH-01: 소셜 로그인 재로그인 버그~~ -- RESOLVED 2026-04-09. Phase 6 VALIDATION 승인 (PR #11, #12 merged). 카카오/네이버/구글 3 provider 재로그인 E2E 검증 완료, 근본 원인은 Strategy callbackURL 의 `/social/` 세그먼트 누락 (b87001d, 87925b1).
- VALK-03: Valkey eval() 시그니처 차이 -- PARTIAL. 코드 레벨 14/14 verified (testcontainers + Lua 3개 라운드트립), 런타임 3/4 PASS (2026-04-13: /health redis up, 좌석 SET NX+TTL, 카탈로그 캐시 hit 52ms). 남은 미검증: (1) CLUSTER 모드 Valkey 호환성, (2) idle 재연결 장기 안정성. Phase 11 진행 중 관찰 후 closed 처리.
- ~~R2-02: R2 CORS AllowedHeaders 와일드카드 불가~~ -- Phase 08에서 content-type 명시적 지정으로 해결
- ADM-06: 통계 쿼리 캐싱 -- 전제조건(Phase 7 Valkey 전환) 완료. Phase 11 어드민 대시보드에서 캐시 레이어 활용 대상으로 이관.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260409-obb | CI 파이프라인 실패 수정 | 2026-04-09 | c937274 | [260409-obb-ci](./quick/260409-obb-ci/) |
| 260409-os1 | 프로덕션 소셜로그인 쿠키 SameSite 버그 수정 | 2026-04-09 | 21eb3d6 | [260409-os1-gcloud](./quick/260409-os1-gcloud/) |
| 260413-jw1 | seed.mjs에 어드민 유저(admin@grapit.test) 추가 | 2026-04-13 | 7bd1753 | [260413-jw1-admin-grapit-test](./quick/260413-jw1-admin-grapit-test/) |
| 260413-k99 | 프로덕션 어드민 접속 불가 수정 (proxy.ts 쿠키 체크 제거) | 2026-04-13 | 5f15b7a | [260413-k99-admin-grapit-test-cli](./quick/260413-k99-admin-grapit-test-cli/) |
| 260417-ghv | 국제 전화번호 입력 UX 개선 — 국가코드 선택 라이브러리 도입 (react-phone-number-input + shadcn wrapper) | 2026-04-17 | 4938d74 | [260417-ghv-ux](./quick/260417-ghv-ux/) |
| 260420-et3 | PR #16 코드리뷰 이슈 3건 수정 (sms:attempts 리셋, phone-axis send 5xx 롤백, Infobip groupId=5 검증) | 2026-04-20 | 8ad4a15 | [260420-et3-pr-16-3-sms-attempts-phone-axis-send-5xx](./quick/260420-et3-pr-16-3-sms-attempts-phone-axis-send-5xx/) |
| 260420-fi4 | Phase 10 UI-REVIEW 3건 수정 (phone-verification: button variant, text-caption 토큰, 타이머 aria-live) | 2026-04-20 | ee910f3 | [260420-fi4-phase-10-ui-review-3-phone-verification-](./quick/260420-fi4-phase-10-ui-review-3-phone-verification-/) |
| 260420-cd7 | CD 복구: Phase 10.1 이후 누락된 프로덕션 시크릿 7개 주입 (Infobip 3 + Sentry api/web + Toss secret/client key) — grapit-api-00018 기동 실패 해소 | 2026-04-20 | c84ff98 | [260420-cd7-deploy-secrets-missing-infobip-sentry-toss](./quick/260420-cd7-deploy-secrets-missing-infobip-sentry-toss/) |
| 260420-ci-toss-secrets-restore | CI 복구: 260420-cd7 에서 오판 제거된 TOSS_CLIENT_KEY_TEST / TOSS_SECRET_KEY_TEST 재등록 (D-13 격리 설계상 ci.yml 전용 — deploy.yml 기준 orphan 검사 false positive) | 2026-04-20 | a7ee3d1 | [260420-ci-toss-secrets-restore](./quick/260420-ci-toss-secrets-restore/) |
| 260420-oxe | PR #17 코드리뷰 수정: kstTodayBoundaryUtc() empty-range 버그로 오늘 KPI 3종 항상 0 반환 → kstBoundaryToUtc(1) 로 교체 + 회귀 테스트 10건 추가 | 2026-04-20 | 84a1594 | [260420-oxe-code-review-fix](./quick/260420-oxe-code-review-fix/) |
| 260422-eya | PR #18 코드리뷰 수정: seat-map-viewer handleClick maxSelect 가드가 locked 좌석 클릭을 차단해 parent toast 미발화 → state !== 'locked' 가드 추가 + 회귀 테스트 3건 (commit 45b884e invariant 복원) | 2026-04-22 | fcc6a7b | [260422-eya-seat-map-viewer-maxselect-locked](./quick/260422-eya-seat-map-viewer-maxselect-locked/) |
| 260424-l23 | Phase 14 pre-existing TTL 2건 수정: sms-throttle.integration.spec.ts 의 throttler key filter 를 실제 라이브러리 format (`{<tracker>:<throttlerName>}:hits`) 에 맞춰 `.endsWith(':hits')` 로 전환 → 28/30 → 30/30 green, Phase 14 ci.yml `test:integration` PR green 블로커 해소 | 2026-04-24 | e65fa99 | [260424-l23-sms-throttle-integration-spec-ts-l220-27](./quick/260424-l23-sms-throttle-integration-spec-ts-l220-27/) |
| 260427-kch | 회원가입 가입완료 시 410 EXPIRED 차단 핫픽스: `auth.service.ts` register/completeSocialRegistration 가 OTP 코드를 `verifyCode` 로 재호출 → Lua 가 OTP 키 DEL 후 EXPIRED 반환 → GoneException. `SmsService.isPhoneVerified` 추가 + GoneException catch fallback 으로 `{sms:{e164}}:verified` 플래그(TTL 600s) idempotency 확인 (sms.service.ts:385-403 자체 권고 반영). 8 회귀 테스트 추가, 315/315 green. main 직접 머지(PR #21) → Cloud Run 자동 배포 | 2026-04-27 | 9b38358 (hotfix/main) | [260427-kch-410-expired-auth-service-ts-verifycode](./quick/260427-kch-410-expired-auth-service-ts-verifycode/) |

## Session Continuity

Last session: --stopped-at
Stopped at: Phase 15 context gathered
Resume file: --resume-file

**Planned Phase:** 15 (resend-heygrabit-com-cutover-transactional-email-secret-mana) — 3 plans — 2026-04-24T08:54:14.266Z
