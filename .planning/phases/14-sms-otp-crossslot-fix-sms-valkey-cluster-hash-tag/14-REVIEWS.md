---
phase: 14
reviewers: [codex]
reviewers_attempted: [codex, cursor]
reviewers_failed: [cursor]
reviewed_at: 2026-04-24T03:18:13Z
plans_reviewed:
  - 14-01-PLAN.md
  - 14-02-PLAN.md
  - 14-03-PLAN.md
  - 14-04-PLAN.md
---

# Cross-AI Plan Review — Phase 14

**Reviewer availability:**
- `codex` — invoked, review captured below
- `cursor` — invocation failed: `Authentication required. Please run 'cursor agent login' first, or set CURSOR_API_KEY environment variable.`
- `claude` — skipped (running inside Claude Code, would not be independent)
- `gemini` / `coderabbit` / `opencode` / `qwen` — not installed

Only a single external reviewer (codex) produced output. Treat the feedback below as one strong opinion, not a consensus of multiple models.

---

## Codex Review

### Summary
전체 방향은 맞습니다. `{sms:${e164}}:otp|attempts|verified` hash tag 설계는 Redis/Valkey Cluster의 multi-key Lua 제약을 정확히 해결하고, Plan 01 → 02/03의 SoT 흐름도 의도는 좋습니다. 다만 현재 plan에는 **CI에 cluster integration test가 실제로 편입되지 않는 문제**, **기존 `sms.service.spec.ts`와 `redis.provider.spec.ts`의 오래된 key 기대값을 충분히 갱신하지 못하는 문제**, **testcontainers cluster bootstrap의 `natMap`/announce flakiness 위험**이 남아 있습니다. 이 세 가지를 보강하면 Phase 14는 프로덕션 SMS 인증 복구 목표와 잘 정렬됩니다.

### Strengths
- Hash tag 스킴이 정확합니다. `{sms:${e164}}:<role>` 구조는 3개 OTP key의 hash slot을 동일하게 만들고, 기존 booking fix 패턴과 일관됩니다.
- rate-limit key를 변경하지 않는 결정이 좋습니다. `sms:phone:send:*`, `sms:phone:verify:*`, resend/cooldown 축은 단일-key 작업이라 CROSSSLOT 원인이 아니고, 바꾸면 quota reset 부작용이 생깁니다.
- Lua 본체를 변경하지 않고 `KEYS[]` 전달 key만 바꾸는 접근이 안전합니다.
- Plan 02/03이 `VERIFY_AND_INCREMENT_LUA`와 key builder를 import하도록 설계한 점은 drift 제거 방향으로 맞습니다.
- frontend UX 변경은 작고 목적이 분명합니다. `verified:false` body의 `message`를 우선 표시하면 시스템 장애와 OTP 오입력을 구분할 수 있습니다.
- HUMAN-UAT가 실제 프로덕션 `heygrabit.com/signup` 실기기 인증을 포함해 goal alignment가 좋습니다.

### Concerns
- **HIGH — cluster integration test가 CI에 실제 편입되지 않습니다.** 현재 `.github/workflows/ci.yml`은 `pnpm test`만 실행하고, `apps/api/package.json`의 `test:integration`은 root/turbo CI 경로에 포함되어 있지 않습니다. Plan 03의 "SUMMARY에 기록"만으로는 D-12 "CI 편입"을 만족하지 못합니다.
- **HIGH — `sms.service.spec.ts` 업데이트 범위가 부족합니다.** 실제 파일에는 `expect.stringContaining('sms:otp:')`, exact `'sms:otp:+821...'`, `sms:attempts`, `sms:verified` 기대값이 다수 있습니다. Plan 14-01 Task 2의 grep은 template literal 패턴만 잡아서 현재 unit test 실패를 놓칠 가능성이 큽니다.
- **MEDIUM — 최종 grep gate가 현재 repo 구조와 충돌합니다.** `rg "sms:otp:|sms:attempts:|sms:verified:" apps/api/src`는 `apps/api/src/modules/sms/sms.service.spec.ts`와 `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` 때문에 실패합니다. production code만 검사하려면 `--glob '!**/*.spec.ts' --glob '!**/__tests__/**'`가 필요하거나, 해당 test들도 함께 갱신해야 합니다.
- **MEDIUM — testcontainers cluster `natMap`가 환경별로 flaky할 수 있습니다.** `CLUSTER SLOTS`가 `${host}:6379`가 아니라 container internal IP를 반환하면 현재 `` natMap: { [`${host}:6379`]: ... } ``가 매칭되지 않습니다. Mac/local/CI 간 차이가 날 수 있습니다.
- **MEDIUM — Plan 03의 "CI 편입 확인만 하고 수정은 별도 아님"은 phase success criteria와 어긋납니다.** SC-2가 "CI 편입"을 포함한다면 workflow 수정 또는 root script/turbo task 추가가 plan 범위에 있어야 합니다.
- **LOW — frontend response type은 `message: string`보다 `message?: string`이 정확합니다.** D-08과 서버 `VerifyResult`는 optional인데, frontend generic은 required로 남아 있습니다.
- **LOW — Sentry 72h 기준은 배포 overlap을 분리해야 합니다.** old revision이 살아 있는 첫 몇 분에는 CROSSSLOT이 발생할 수 있으므로, 72h zero-count window는 "새 API revision 100% traffic 전환 + 15분 drain 이후"부터 잡는 편이 더 명확합니다.

### Suggestions
- Plan 03 또는 별도 Plan에 CI 변경을 추가하세요: `.github/workflows/ci.yml`에 `pnpm --filter @grabit/api test:integration`을 명시적으로 넣는 것이 가장 단순합니다.
- Plan 14-01 Task 2를 강화하세요. `sms.service.spec.ts`에서 다음 기대값을 모두 새 builder 기반으로 바꿔야 합니다: `expect.stringContaining('sms:otp:')`, exact `sms:otp:+...`, `sms:attempts:+...`, `sms:verified:` 관련 assertion/comment.
- `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts`의 pipeline test도 새 key shape로 바꾸거나, 최종 grep gate에서 spec/test 파일을 제외하세요.
- cluster bootstrap은 `CLUSTER SLOTS` 결과를 읽어서 반환된 `ip:port`를 동적으로 `natMap`에 매핑하는 방식이 더 견고합니다. 최소한 실패 시 fallback으로 parsed slot node address를 기록하게 하세요.
- frontend generic을 `apiClient.post<{ verified: boolean; message?: string }>`로 바꾸면 D-08과 타입 계약이 일치합니다.
- 검증 command는 `-- --run`을 줄이고 명확히 정리하세요. 예: `pnpm --filter @grabit/api test:integration -- sms-cluster-crossslot`.

### Risk Assessment
**Overall risk: MEDIUM.** 핵심 코드 수정 자체는 낮은 위험이고, hash-tag 설계도 맞습니다. 위험의 대부분은 구현 로직이 아니라 **검증 체계가 실제로 닫히지 않을 가능성**입니다: integration test가 CI에서 안 돌 수 있고, 기존 unit/spec 파일의 stale key expectation이 남아 suite를 깨거나 false confidence를 줄 수 있습니다. 위 보강을 반영하면 risk는 LOW로 내려갈 수 있습니다.

---

## Cursor Review

_Cursor CLI 인증이 설정되지 않아 리뷰를 수행하지 못했습니다._

```
Error: Authentication required. Please run 'cursor agent login' first, or set CURSOR_API_KEY environment variable.
```

추후 cursor 로그인 후 `/gsd-review --phase 14 --cursor` 로 재실행 가능합니다.

---

## Consensus Summary

단일 리뷰어(codex)만 성공했으므로 "consensus" 대신 codex 의 강경 의견을 최우선 반영 후보로 요약합니다. 복수 리뷰어 합의가 아니라는 한계를 명시합니다.

### Agreed Strengths
(2+ reviewers 미달 — 단일 리뷰어 기준)
- Hash tag `{sms:<e164>}:<role>` 설계가 Valkey Cluster multi-key Lua 제약을 정확히 해결
- rate-limit key 를 의도적으로 건드리지 않은 범위 결정이 올바름
- Plan 01 의 4-symbol export + Plan 02/03 import 흐름이 drift 제거 방향으로 맞음

### Agreed Concerns (단일 리뷰어 기준 최우선 처리 후보)
1. **[HIGH] CI 편입 실체화** — `.github/workflows/ci.yml` 또는 turbo/root script 에 `pnpm --filter @grabit/api test:integration` 을 명시 추가하지 않으면 D-12 / SC-2 를 실제로 만족하지 않음. Plan 03 (또는 별도 plan) 의 명시적 task 로 승격 필요.
2. **[HIGH] 기존 spec 파일의 stale key 기대값** — `sms.service.spec.ts` 의 `sms:otp:` / `sms:attempts:` / `sms:verified:` 리터럴 기대값과 `redis.provider.spec.ts` 의 pipeline 테스트가 Plan 14-01 의 grep/수정 범위에 제대로 포함되지 않으면 unit test 가 깨짐. Task 2 의 grep 를 리터럴까지 확장하거나 완료 gate 에서 spec/test 를 제외 필요.
3. **[MEDIUM] testcontainers cluster bootstrap flakiness** — `CLUSTER SLOTS` 가 container internal IP 를 반환하는 경우 현 `natMap` 매칭 실패 가능. `CLUSTER SLOTS` 결과를 파싱해 동적으로 natMap 을 구성하는 fallback 필요.
4. **[MEDIUM] final grep gate 가 spec 파일을 포함해 실패 가능** — `apps/api/src` 전체 grep 시 spec/__tests__ 파일이 hit. `--glob '!**/*.spec.ts' --glob '!**/__tests__/**'` 적용 또는 해당 spec 동시 갱신 중 선택 필요.

### 단일 리뷰어 관점에서 가시화된 추가 항목
- **[LOW] frontend response type** `message: string` → `message?: string` (D-08 / 서버 VerifyResult optional 과 일치)
- **[LOW] Sentry 72h 기준 재정의** — "새 API revision 100% traffic + 15분 drain 이후"부터 72h zero-count window 시작하도록 UAT 기준 보강

### Divergent Views
단일 리뷰어이므로 해당 없음. cursor/gemini/기타 모델 추가 시 재검토 필요.

---

## Reviewer Environment Notes

- 본 리뷰는 Claude Code (claude-opus-4-7 1M) 환경에서 `/gsd-review --phase 14 --all` 로 시작되었고, 환경 기반 runtime detection 에 따라 `claude` 는 independence 목적상 skip.
- gemini/coderabbit/opencode/qwen 미설치, cursor 미인증으로 codex 단일 리뷰로 축소됨. 추후 외부 CLI 추가 설치 후 재실행해 2+ 리뷰어 consensus 확보 권장.
