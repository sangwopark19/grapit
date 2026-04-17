---
phase: 10
reviewers: [codex]
reviewed_at: 2026-04-16T12:00:00Z
plans_reviewed:
  - 10-01-wave0-test-scaffolding-PLAN.md
  - 10-02-deps-env-cleanup-PLAN.md
  - 10-03-phone-util-PLAN.md
  - 10-04-infobip-client-PLAN.md
  - 10-05-sms-service-rewrite-PLAN.md
  - 10-06-sms-controller-throttle-PLAN.md
  - 10-07-throttler-valkey-storage-PLAN.md
  - 10-08-phone-verification-ui-PLAN.md
  - 10-09-e2e-verification-PLAN.md
---

# Cross-AI Plan Review — Phase 10

## Codex Review

### Summary

전체적으로 Phase 10 계획은 목표 달성 가능성이 높습니다. Twilio 제거, Infobip PIN API 전환, phone/IP rate limiting, dev mock 유지, UI cooldown, E2E까지 단계가 잘 나뉘어 있고 RED→GREEN 흐름도 명확합니다. 다만 핵심 위험은 **Infobip PIN API 실제 계약/템플릿/애플리케이션 설정과 코드 계약이 정확히 맞는지**, **Valkey key/counter 원자성**, **NestJS Throttler v6 설정 단위와 decorator semantics**, **SmsModule이 BookingModule에서 Redis를 가져오는 모듈 의존성 결합**입니다. 구현 전에 이 네 가지는 plan level에서 더 단단히 못 박아야 합니다.

### Strengths

- Twilio를 부분 교체하지 않고 Infobip 중심으로 완전히 전환하는 방향은 좋습니다. provider abstraction이 필요하지 않은 MVP 단계에서는 단순성이 더 중요합니다.
- phone axis와 IP axis를 분리하고 OR 평가로 제한하는 설계는 abuse 방어에 실질적입니다.
- `sendVerificationCode` / `verifyCode` response contract를 immutable로 둔 점은 기존 `auth.service.ts` 호환성을 잘 고려했습니다.
- production hard-fail + dev mock `000000` 전략은 배포 안정성과 CI 재현성을 동시에 만족합니다.
- `+86` 차단, OTP lifetime, resend cooldown, max attempts 등 정책이 구체적이라 구현 중 해석 여지가 적습니다.
- Infobip SDK를 피하고 native `fetch` wrapper를 쓰는 선택은 dependency risk와 bundle surface를 줄입니다.
- UI 계획이 단순히 API 연동에 그치지 않고 resend state, error copy, accessibility까지 포함합니다.
- Plan 09에서 실제 staging smoke를 human checkpoint로 둔 것은 SMS 연동 특성상 필요합니다.

### Concerns

| # | Severity | Concern |
|---|----------|---------|
| 1 | **HIGH** | **Infobip PIN API payload/credential contract 검증 부족** — `sendPin()`과 `verifyPin()` endpoint만 언급되어 있고, 실제 required fields인 application/template/messageId 관련 값이 어떤 env var 4개에 매핑되는지 plan에 충분히 고정되어 있지 않습니다. Infobip 2FA는 portal 설정과 API payload가 맞지 않으면 코드가 맞아도 실발송이 실패합니다. |
| 2 | **HIGH** | **max attempts 5가 실제로 어디서 보장되는지 불명확** — `verify-code: phone 10/15min`은 rate limit이고, OTP별 max attempts 5와는 다른 정책입니다. Plan 05에는 `pinId` lookup과 Infobip verify만 있고 `sms:attempts:{pinId\|phone}` 같은 attempt counter가 명시되지 않았습니다. Infobip template 정책으로 처리할 수도 있지만, phase requirement SMS-04를 만족하려면 앱 레벨 또는 provider 레벨 근거가 필요합니다. |
| 3 | **HIGH** | **cooldown key 선점 후 Infobip 발송 실패 시 UX deadlock 가능성** — Plan 05 순서가 `resend cooldown SET NX → phone counter → Infobip sendPin`입니다. Infobip 장애나 5xx가 나면 사용자는 실제 문자를 받지 못했는데 30초 cooldown에 걸립니다. 의도한 abuse 방어일 수 있지만, 실패 유형별 rollback 여부가 정의되어야 합니다. |
| 4 | **MEDIUM** | **Valkey counter 원자성/TTL 설정 race condition 가능성** — phone counter가 `INCR` 후 첫 증가일 때 `EXPIRE`를 별도로 호출하면 프로세스 crash 시 TTL 없는 key가 남을 수 있습니다. Lua script 또는 pipeline + defensive TTL 보정이 필요합니다. |
| 5 | **MEDIUM** | **`SmsModule imports BookingModule for REDIS_CLIENT`는 모듈 경계가 어색함** — SMS가 BookingModule에 의존하면 domain dependency가 뒤집힙니다. `RedisModule`, `CacheModule`, `InfraModule` 같은 shared provider로 분리하는 편이 이후 throttler, booking, auth에서 더 안전합니다. |
| 6 | **MEDIUM** | **Throttler TTL 단위 혼동 위험** — Plan 06은 "v6 object signature, ms TTL"이라고 되어 있는데, 실제 decorator와 storage adapter가 TTL을 seconds/ms 중 무엇으로 기대하는지 반드시 코드와 테스트에서 확인해야 합니다. |
| 7 | **MEDIUM** | **controller IP throttle과 service phone throttle의 error response 일관성 미정** — `@Throttle`에서 발생하는 429와 service 내부 phone limit 429가 같은 response shape/error copy로 매핑되는지 계획에 없습니다. |
| 8 | **MEDIUM** | **중국 번호 차단 normalization edge case** — `+86`으로 시작하는 비정상/부분 입력, 국제 prefix `0086`, whitespace, full-width digit 등 테스트 포함 필요 |
| 9 | **LOW** | **test scaffolding 7개 과한 RED 유지 비용** — Plan 01이 implementation details까지 과도하게 고정하면 이후 좋은 구현 변경이 테스트에 막힐 수 있습니다. |
| 10 | **LOW** | **DEPLOY-CHECKLIST.md가 Plan 02와 Plan 09에서 모두 수정** — 충돌은 작지만 위치를 미리 정하면 덜 흔들림 |

### Plan-by-Plan Risk Matrix

| Plan | Main Risk | Risk Level |
|------|-----------|------------|
| 01 Test Scaffolding | brittle tests | MEDIUM |
| 02 Dependencies & Env | Infobip env var 명세 부족 | MEDIUM |
| 03 Phone Utility | normalization edge cases | LOW-MEDIUM |
| 04 Infobip Client | API payload/response schema 불확실성 | MEDIUM |
| 05 SMS Service Rewrite | policy gaps (attempts, atomicity, failure rollback) | HIGH |
| 06 Controller Throttle | TTL unit / error shape mismatch | MEDIUM |
| 07 Throttler Valkey Storage | BookingModule dependency coupling | MEDIUM |
| 08 Phone Verification UI | backend error contract와 불일치 가능성 | LOW-MEDIUM |
| 09 E2E Verification | manual smoke가 merge gate인지 불명확 | MEDIUM |

### Suggestions

1. Plan 02 또는 04에 Infobip env var contract를 명시하세요: `INFOBIP_BASE_URL`, `INFOBIP_API_KEY`, `INFOBIP_APPLICATION_ID`, `INFOBIP_MESSAGE_ID` — 코드와 portal 설정이 1:1로 보이게.
2. Plan 05에 OTP attempt counter를 명시하세요. Infobip Application `pinAttempts=5` 위임이 근거라면 명시적으로 기록.
3. Valkey rate limit은 Lua script나 pipeline으로 `INCR + EXPIRE`를 원자적으로 처리하도록 계획에 추가.
4. `REDIS_CLIENT`는 BookingModule에서 끌어오지 말고 shared infrastructure module로 분리 권장. Phase 10 범위가 부담되면 최소한 `RedisModule` extraction을 Plan 07에 포함.
5. Infobip 발송 실패 시 cooldown key를 유지할지 삭제할지 정책을 정하세요. 일반적으로 4xx는 유지, network/5xx/timeout은 삭제 또는 짧은 TTL로 낮추는 방식.
6. controller throttler와 service throttler의 429 response format을 통일하세요. Frontend의 HTTP status mapping 안정성.
7. Plan 06/07에 Throttler v6 TTL 단위 검증 테스트를 명시.
8. Plan 01 테스트에 edge case 추가: expired PIN, missing pinId, reused PIN, Infobip timeout, 4xx vs 5xx, cooldown after failed send, `0086`/`+86`/formatted CN input.
9. Plan 09의 staging smoke를 "merge/deploy blocker인지, checklist 기록만 하는지" 명확히 정의.

### Overall Risk Assessment

**MEDIUM-HIGH** — 계획의 구조와 범위 분리는 좋고, phase goal 자체는 달성 가능성이 높습니다. 하지만 SMS 실연동은 코드보다 provider 설정, rate limit semantics, failure handling이 더 자주 문제를 만듭니다. 현재 계획은 happy path와 주요 UX는 잘 잡혀 있지만, **Infobip contract**, **OTP max attempts**, **Valkey atomicity**, **Nest module dependency**가 아직 plan 단계에서 충분히 닫히지 않았습니다. 이 네 가지를 보강하면 전체 위험도는 **MEDIUM**까지 내려갈 수 있습니다.

---

## Consensus Summary

> 리뷰어 1명(Codex)만 참여했으므로 consensus는 단독 리뷰 기반입니다.

### Top Concerns (Action Required)

1. **Infobip 발송 실패 시 cooldown key rollback 정책** (HIGH) — 5xx/timeout 시 사용자가 30초 동안 재발송 불가. Plan 05에 실패 유형별 cooldown key 삭제 정책 추가 필요.
2. **OTP max attempts 5회의 보장 근거** (HIGH) — Infobip Application `pinAttempts=5`에 위임한다면 CONTEXT/PLAN에 명시적 기록 필요. 앱 레벨 카운터 부재가 의도적임을 증명.
3. **Valkey INCR+EXPIRE 원자성** (MEDIUM) — Lua script 또는 pipeline으로 첫 INCR 시 TTL을 원자적으로 설정. 프로세스 crash 시 TTL 없는 좀비 key 방지.

### Agreed Strengths

- 전면 교체 + provider abstraction 회피는 1인 개발에 맞는 단순성
- phone/IP 2-axis rate limiting 설계
- response contract immutable 유지
- RED→GREEN TDD 흐름
- production hard-fail + dev mock 전략

### Divergent Views

- **BookingModule 의존성**: Codex는 shared RedisModule 분리를 권장하나, 1인 개발 규모에서는 현행 방식도 수용 가능. Phase 10 scope 확대 vs 기술 부채 수용 트레이드오프.
- **staging smoke의 merge blocker 여부**: SMS 연동 특성상 blocker가 이상적이나, 1인 개발에서는 체크리스트 기록만으로도 충분할 수 있음.
