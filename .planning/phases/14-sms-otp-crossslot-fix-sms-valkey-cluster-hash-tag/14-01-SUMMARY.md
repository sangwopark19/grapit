---
phase: 14
plan: 01
subsystem: sms-otp / valkey-cluster
tags: [sms, valkey, cluster, hash-tag, refactor, cross-slot-fix]
requires: []
provides:
  exports:
    - "smsOtpKey(e164: string): string — `{sms:${e164}}:otp`"
    - "smsAttemptsKey(e164: string): string — `{sms:${e164}}:attempts`"
    - "smsVerifiedKey(e164: string): string — `{sms:${e164}}:verified`"
    - "VERIFY_AND_INCREMENT_LUA: string — atomic multi-key Lua (body byte-identical to Phase 10.1)"
  artifacts:
    - "apps/api/src/modules/sms/sms.service.ts — hash-tag 적용된 3개 OTP 키 빌더 export + Lua export 상수 + 호출부 전환"
    - "apps/api/src/modules/sms/sms.service.spec.ts — drift-free 기대값 (builder import 기반)"
    - "apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts — hash-tag 리터럴 pipeline 테스트"
affects:
  - "SC-2 (cluster-mode guard test at 14-03) — 4 symbol export 가 downstream integration test 의 import 전제"
  - "SC-3 (API test suite green) — unit suite 이미 green; integration green 은 Plan 02 후"
tech-stack:
  added: []
  patterns:
    - "Redis Cluster hash-tag: `{<common>}:<role>` (booking commit b382e39 복제)"
    - "Module-level export 로 Lua + key builder single source of truth (D-13)"
key-files:
  created: []
  modified:
    - "apps/api/src/modules/sms/sms.service.ts"
    - "apps/api/src/modules/sms/sms.service.spec.ts"
    - "apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts"
decisions:
  - "hash-tag 규격: `{sms:${e164}}:<role>` (D-01/D-02)"
  - "Lua body byte-identical 유지 (D-05) — KEYS[] 이름만 전달 쪽에서 바뀜"
  - "rate-limit / resend / cooldown 키는 불변 (D-04/D-15)"
  - "spec 파일 drift 옵션 B 채택: spec 갱신 후 전역 grep gate 통과 (REVIEWS.md MEDIUM#3)"
metrics:
  duration_min: 7
  completed_utc: 2026-04-24T05:33:40Z
  tasks_completed: 2
  commits: 2
---

# Phase 14 Plan 01: SMS OTP 키 hash-tag 적용 + builder export Summary

**One-liner:** SmsService 의 3 OTP 키를 `{sms:${e164}}:<role>` hash-tag 형태로 전환하고, 빌더 3종 + `VERIFY_AND_INCREMENT_LUA` 를 module-level export 로 승격해 cluster-mode Valkey 의 CROSSSLOT 에러를 근원 제거하면서 Plan 02/03 integration test 의 drift-free 단일 원천을 확정.

## Completed Tasks

| Task | Name                                                          | Commit    | Files modified                                                                                                                                      |
| ---- | ------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Export 3 key builders + VERIFY_AND_INCREMENT_LUA              | `5e32222` | `apps/api/src/modules/sms/sms.service.ts`                                                                                                           |
| 2    | Update specs to hash-tag scheme (REVIEWS.md HIGH#2 / MEDIUM#3) | `6beb2c3` | `apps/api/src/modules/sms/sms.service.spec.ts`, `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts`                          |

## Modified Line Ranges

### `apps/api/src/modules/sms/sms.service.ts` (26 insertions, 14 deletions)
- **L39-56** — `VERIFY_AND_INCREMENT_LUA` docstring: KEYS 주석 3줄을 `{sms:{e164}}:<role>` 로 전면 교체 + `Hash tag \`{sms:{e164}}\` ensures all 3 keys hash to the same Redis Cluster slot.` 문장 추가.
- **L57** — `const VERIFY_AND_INCREMENT_LUA = \`` → `export const VERIFY_AND_INCREMENT_LUA = \`` (promote to module-level export, D-13).
- **L58-82 (Lua body)** — **byte-identical 유지** (D-05). `local stored = redis.call('GET', KEYS[1])` 부터 `return {'WRONG', max - attempts}` closing backtick 까지 25 lines 불변.
- **L83-91** — `SendResult`/`VerifyResult` interface 위에 hash-tag 키 빌더 3종 + 주석 블록(6줄) 신규 추가. 주석은 b382e39 commit 레퍼런스 포함.
- **L222** — `// OTP storage. sms:attempts:{e164} TTL is 900s` → `{sms:{e164}}:attempts TTL is 900s` (주석 내 리터럴 제거).
- **L232-234 (pipeline)** — `pipeline.set(\`sms:otp:${e164}\`, …)` → `pipeline.set(smsOtpKey(e164), …)`, 동일하게 `pipeline.del(smsAttemptsKey(e164))`.
- **L321, L339, L351** — verifyCode docstring/security note 3곳의 `sms:verified:{e164}` → `{sms:{e164}}:verified` (주석 리터럴 제거).
- **L360-369 (EVAL)** — `this.redis.eval(VERIFY_AND_INCREMENT_LUA, 3, \`sms:otp:${e164}\`, \`sms:attempts:${e164}\`, \`sms:verified:${e164}\`, code, …)` → `smsOtpKey(e164)`, `smsAttemptsKey(e164)`, `smsVerifiedKey(e164)` 빌더 호출로 교체.
- **Do-not-touch 재확인 (pre-edit=post-edit exact count 5):**
  - L176 `sms:resend:${e164}` (cooldown SET NX) — 불변
  - L201 `sms:phone:send:${e164}` atomicIncr — 불변
  - L271 `sms:phone:send:${e164}` DECR rollback — 불변
  - L326 `sms:phone:verify:${e164}` atomicIncr — 불변
  - L398 `sms:phone:verify:${e164}` DECR rollback — 불변
  - L31-37 `ATOMIC_INCR_LUA` — 불변 (D-06)
  - L390-415 catch message — 불변 (D-14)

### `apps/api/src/modules/sms/sms.service.spec.ts` (수정 지점 8)
- **L4** 파일 docstring 의 `sms:otp:{e164}` → `{sms:{e164}}:otp`
- **L13-19** import 문에 `smsOtpKey`, `smsAttemptsKey`, `smsVerifiedKey` 추가 (D-13 SoT import)
- **L28** 주석 `sms:attempts:{e164}` → `{sms:{e164}}:attempts`
- **L278** test title `(sms:otp:{e164}, TTL 180s)` → `({sms:{e164}}:otp, TTL 180s)`
- **L296** `expect.stringContaining('sms:otp:')` → `smsOtpKey('+821012345678')`
- **L476-477** test title / comment 의 `sms:attempts:{e164}` → `{sms:{e164}}:attempts`
- **L501, L508** exact 리터럴 `'sms:otp:+821012345678'` / `'sms:attempts:+821012345678'` → `smsOtpKey('+821012345678')` / `smsAttemptsKey('+821012345678')`
- **L577** test title `sms:verified:{e164}` → `{sms:{e164}}:verified`
- **L593-595** `expect.stringContaining` 3줄 → builder 호출 3줄
- **L729-730, L754, L755, L770, L775, L779** CR-01 블록의 6개 `sms:verified:` 참조 (test title, 주석, `expect.stringContaining('sms:verified:')`) → hash-tag 형태 (`{sms:{e164}}:verified`) 또는 `':verified'` substring 매칭으로 갱신
- **Rate-limit 리터럴 (pre-edit=post-edit=16 count):** `sms:phone:send:`, `sms:phone:verify:`, `sms:resend:`, `sms:cooldown:` 참조 모두 **불변** (D-04)

### `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` (수정 지점 3)
- **L153** `.set('sms:otp:+821012345678', …)` → `.set('{sms:+821012345678}:otp', …)`
- **L154** `.del('sms:attempts:+821012345678')` → `.del('{sms:+821012345678}:attempts')`
- **L164 (+ L163 주석)** `redis.get('sms:otp:+821012345678')` → `redis.get('{sms:+821012345678}:otp')`
- **booking rate-limit / send 리터럴 (L115, L119, L123, L137-139):** sms:resend:+… / sms:phone:send:+… 불변 (D-04)
- **no sms.service import added** (booking 모듈 cross-module dep 신설 회피 — 리터럴만 교체)

## Export Signatures (Plan 02/03 가 import 할 4 symbol)

```typescript
// apps/api/src/modules/sms/sms.service.ts (L57, L89-91)
export const VERIFY_AND_INCREMENT_LUA: string;
export const smsOtpKey:      (e164: string) => string;
export const smsAttemptsKey: (e164: string) => string;
export const smsVerifiedKey: (e164: string) => string;
```

예시 출력:
- `smsOtpKey('+821012345678')` → `'{sms:+821012345678}:otp'`
- `smsAttemptsKey('+821012345678')` → `'{sms:+821012345678}:attempts'`
- `smsVerifiedKey('+821012345678')` → `'{sms:+821012345678}:verified'`

## Lua Body Byte-Identical Proof

Pre-edit Lua body (Phase 10.1 L55-79) vs. post-edit (Phase 14 L58-82):
- **Line count:** 25 (post-edit `awk '/^export const VERIFY_AND_INCREMENT_LUA = \`/,/^\`;$/' | wc -l` = 25)
- **외부 토큰 유일 변화:** `const` → `export const` (L57 선언부만)
- **본체 토큰:** `local stored = redis.call('GET', KEYS[1]) ... return {'WRONG', max - attempts}` — 문자 그대로 유지. 첫/마지막 backtick 포함 본체는 변경 없음. (git diff 육안 확인 완료)

## Verification Evidence

| Gate                                                                          | Expected | Actual | Status |
| ----------------------------------------------------------------------------- | -------- | ------ | ------ |
| `^export const smsOtpKey`                                                     | 1 line   | 1      | PASS   |
| `^export const smsAttemptsKey`                                                | 1 line   | 1      | PASS   |
| `^export const smsVerifiedKey`                                                | 1 line   | 1      | PASS   |
| `^export const VERIFY_AND_INCREMENT_LUA`                                      | 1 line   | 1      | PASS   |
| `sms:otp:|sms:attempts:|sms:verified:` in `sms.service.ts`                    | 0        | 0      | PASS   |
| `{sms:${e164}}:(otp|attempts|verified)` in `sms.service.ts`                   | 3        | 3      | PASS   |
| rate-limit literal exact-count in `sms.service.ts`                            | 5        | 5      | PASS   |
| `smsOtpKey(e164)` call-sites                                                  | 2        | 2      | PASS   |
| `smsAttemptsKey(e164)` call-sites                                             | 2        | 2      | PASS   |
| `smsVerifiedKey(e164)` call-sites                                             | 1        | 1      | PASS   |
| Lua body line count                                                           | 25       | 25     | PASS   |
| `sms:otp:|sms:attempts:|sms:verified:` in `sms.service.spec.ts`               | 0        | 0      | PASS   |
| `{sms:` in `sms.service.spec.ts`                                              | > 0      | 12     | PASS   |
| `smsOtpKey|smsAttemptsKey|smsVerifiedKey` usage in `sms.service.spec.ts`      | ≥ 3      | 9      | PASS   |
| rate-limit literal count in `sms.service.spec.ts` (pre=post)                  | 16       | 16     | PASS   |
| `sms:otp:|...|sms:verified:` in `redis.provider.spec.ts`                      | 0        | 0      | PASS   |
| `{sms:+821012345678}:(otp|attempts)` in `redis.provider.spec.ts`              | ≥ 2      | 3      | PASS   |
| **MEDIUM#3 option B final gate** — `rg "sms:otp:|sms:attempts:|sms:verified:" apps/api/src` | 0 matches | 0 | PASS   |
| `pnpm --filter @grabit/api typecheck`                                         | exit 0   | exit 0 | PASS   |
| `pnpm --filter @grabit/api test`                                              | all green | 283/283 | PASS |
| `pnpm --filter @grabit/api lint`                                              | no new warning on sms.service.ts | 0 on sms.service.ts | PASS |

## Deviations from Plan

**None substantive.** Plan 지시를 그대로 따랐으며 변경된 라인 범위도 plan action step 과 1:1 매칭.

단 1개 관찰:
- **Plan acceptance `grep -n "Hash tag .sms:.e164.. ensures"`** 는 POSIX BRE regex 관점에서 `.` 와 literal `` ` `` 매칭이 모호. 실제 docstring (`Hash tag \`{sms:{e164}}\` ensures all 3 keys hash to the same Redis Cluster slot.`) 은 의도대로 삽입됐으며 단순 `grep -c "Hash tag"` 로 1회 매칭 확인. Plan 의 regex 자체가 noisy 였을 뿐 acceptance 의 정신(docstring closing sentence 존재)은 충족.

## Authentication Gates

없음. 모든 작업은 Edit / grep / `pnpm typecheck` / `pnpm test` / `git commit` 로만 구성.

## REVIEWS.md 해소 증빙

### HIGH#2 — stale spec 기대값 전면 갱신
- `sms.service.spec.ts` 의 `expect.stringContaining('sms:otp:')` / exact `'sms:otp:+821...'` / `'sms:attempts:+821...'` / `expect.stringContaining('sms:verified:')` 패턴 **3종 전부** builder 호출 또는 `':verified'` substring 매칭으로 치환.
- `redis.provider.spec.ts` 의 exact 리터럴 3개 (L153/154/164) 를 hash-tag 리터럴로 교체.
- Post-edit 테스트 283/283 green.

### MEDIUM#3 — final grep gate 옵션 B 달성
- `rg "sms:otp:|sms:attempts:|sms:verified:" apps/api/src` → **0 matches** (production + spec 전체). glob 제외 없이도 깨끗.
- 출력:
  ```
  $ grep -rcE "sms:otp:|sms:attempts:|sms:verified:" apps/api/src | grep -v ":0$"
  EMPTY (all files 0 matches)
  ```

## Known Stubs

없음. 이 plan 은 기존 동작을 변경하지 않고 키 이름만 전환하는 리팩토링 성격.

## Threat Flags

없음. 새 attack surface 도입 없음 (키 내부 이름만 변경, 외부 API 계약 / 응답 shape / 인증 로직 불변 — 14-01-PLAN.md threat model L402-421 에 기재된 disposition 그대로 유효).

## TDD Gate Compliance

본 plan 은 `type: execute` (refactor + test update). TDD 사이클 대신 **existing regression suite 기준 RED→GREEN** 으로 진행:
- Task 1 commit (`5e32222`) 직후에는 기존 spec 파일이 과거 리터럴 기대값을 들고 있어 일부 테스트가 RED 상태였을 것 (실행 없이 논리로 확인).
- Task 2 commit (`6beb2c3`) 에서 spec 을 갱신하고 283 테스트 전체 GREEN 확인.

`test:` prefix commit (Task 2) 이 `refactor:` prefix commit (Task 1) **이후** 에 있어, 키 쪽 고정 없이 production code 가 먼저 리팩터된 뒤 테스트가 맞춰지는 순서. 전형적인 RED → GREEN 사이클은 아니지만 phase 목표(CROSSSLOT 근원 픽스) 의 시간 순서와 atomicity 를 위해 의도된 순서.

## Self-Check: PASSED

파일 존재 확인:
- `apps/api/src/modules/sms/sms.service.ts` — FOUND (modified)
- `apps/api/src/modules/sms/sms.service.spec.ts` — FOUND (modified)
- `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` — FOUND (modified)

커밋 존재 확인:
- `5e32222 refactor(14-01): apply hash-tag scheme to SMS OTP keys + export builders` — FOUND
- `6beb2c3 test(14-01): update sms.service/redis.provider specs to hash-tag scheme` — FOUND

Phase-level verification final gate:
- `rg "sms:otp:|sms:attempts:|sms:verified:" apps/api/src` — 0 matches
- `pnpm --filter @grabit/api typecheck` — exit 0
- `pnpm --filter @grabit/api test` — 283 passed (29 files)

---

*Plan: 14-01 — SMS OTP hash-tag 적용 + builder/Lua export*
*Phase: 14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag*
*Completed: 2026-04-24T05:33:40Z*
