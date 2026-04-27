---
plan_id: 260427-kch
status: complete
type: execute
mode: quick
description: "회원가입 가입완료 시 410 EXPIRED 에러 수정 — auth.service.ts 의 verifyCode 이중 호출을 idempotent re-verify 로 처리"
branch: gsd/phase-15-resend-heygrabit-cutover
deploy_target: "main (hotfix merge)"
files_modified:
  - apps/api/src/modules/sms/sms.service.ts
  - apps/api/src/modules/auth/auth.service.ts
  - apps/api/src/modules/sms/sms.service.spec.ts
  - apps/api/src/modules/auth/auth.service.spec.ts
commits:
  - hash: 5e04228
    type: fix
    scope: auth
    message: "handle idempotent re-verify on register/social-register (410 EXPIRED hotfix)"
  - hash: 5df4203
    type: test
    scope: auth
    message: "add regression coverage for 410 EXPIRED idempotent re-verify hotfix"
verification:
  typecheck: pass
  lint: "pass (0 errors, 36 pre-existing warnings — unchanged)"
  tests: "29 files / 315 tests / 0 fail (sms.service 67/67, auth.service 28/28)"
threat_register_addressed:
  - T-260427-kch-01 (Spoofing — controller endpoint 미노출 + JSDoc 명시)
  - T-260427-kch-03 (Info Disclosure — Redis 에러 로그에 e164 만 포함)
  - T-260427-kch-04 (Tampering — verifyCode CR-01 단언 유지, GoneException 직후만 fallback)
  - T-260427-kch-05 (DoS — Redis 다운 시 fail-closed false 반환)
---

# Quick Task 260427-kch: 410 EXPIRED 가입완료 버그 수정

## What

회원가입 마지막 단계 (`POST /api/v1/auth/register`, `POST /api/v1/auth/social/complete-registration`)에서 410 GoneException 으로 가입이 차단되는 버그를 수정. 4 개 파일 변경.

| 파일 | 변경 |
|---|---|
| `apps/api/src/modules/sms/sms.service.ts` | `isPhoneVerified(phone): Promise<boolean>` public 메서드 신규 추가 |
| `apps/api/src/modules/auth/auth.service.ts` | `assertPhoneVerified(phone, code)` private helper 신규 + `register` / `completeSocialRegistration` 의 phone-verify 블록 1 줄로 교체. `GoneException` import 추가 |
| `apps/api/src/modules/sms/sms.service.spec.ts` | `describe('isPhoneVerified', ...)` 4 개 신규 it (production '1' / null / dev mock / Redis 에러) |
| `apps/api/src/modules/auth/auth.service.spec.ts` | register / completeSocialRegistration 회귀 케이스 4 개 신규 (`[hotfix 260427-kch]` 태그). `mockSmsService` 를 outer `let` 으로 호이스트, `integSms` 에 `isPhoneVerified` 추가, `GoneException` import 추가 |

## Why

**Root cause**: 프론트엔드가 `POST /api/v1/sms/verify-code` 로 OTP 를 한 번 검증해 OTP 키(`{sms:{e164}}:otp`)를 DEL 한 직후, `POST /api/v1/auth/register` 가 같은 OTP 로 `verifyCode()` 를 다시 호출 → Lua 스크립트가 OTP 키를 못 찾아 `EXPIRED` 반환 → `GoneException` (410) throw. 결과: 정상 사용자가 가입 완료 시 410 을 받고 가입 자체가 차단됨.

**Impact**: 모든 신규 가입(이메일 + 카카오/네이버/구글 소셜) 차단. 프로덕션 핫픽스 필요.

**왜 verifyCode 자체를 안 고치고 fallback 으로 처리했나**: `verifyCode` 의 [CR-01] 보안 단언 — "잘못된 코드는 항상 거부, 어떤 short-circuit 도 없음" — 을 보존해야 함. 이전에 `{sms:{e164}}:verified` flag 가 있으면 `code` 와 무관하게 `verified: true` 를 리턴하던 short-circuit 이 impersonation 취약점이었기에 명시적으로 제거됐음 (sms.service.ts:385-403 주석 참조). 따라서 verifyCode 는 그대로 두고, 호출자(auth.service)가 GoneException 발생 *직후* 에만 idempotency 신호로 verified flag 를 조회하도록 하는 것이 올바른 layering.

## How

### SmsService.isPhoneVerified(phone): Promise<boolean>

- **dev mock 모드** → `false` 즉시 반환 (dev 흐름은 `verifyCode('000000')` 로 통과하므로 fallback 불필요)
- **production**:
  - `parseE164(phone)` (libphonenumber 정규화 — 잘못된 입력은 throw 하여 호출자에게 propagate)
  - `this.redis.get(smsVerifiedKey(e164))` → `'1'` 이면 `true`, 그 외 (`null` / 다른 값) → `false`
- **Redis 에러** → `warn` 로그 (`event: 'sms.is_phone_verified_failed'`, e164 만 포함, 메시지 본문에 PII 없음) + `false` 반환 (fail closed — Valkey blip 시 가짜 통과 방지)

### AuthService.assertPhoneVerified(phone, code): Promise<void>

DRY private helper — `register` 와 `completeSocialRegistration` 두 곳에서 호출:

```typescript
try {
  const verifyResult = await this.smsService.verifyCode(phone, code);
  if (!verifyResult.verified) {
    throw new BadRequestException('전화번호 인증이 완료되지 않았습니다');
  }
} catch (err) {
  if (err instanceof GoneException) {
    const alreadyVerified = await this.smsService.isPhoneVerified(phone);
    if (!alreadyVerified) throw err; // truly expired — propagate 410
    return;
  }
  throw err;
}
```

분기 행렬:

| verifyCode 결과 | isPhoneVerified | 결과 |
|---|---|---|
| `{ verified: true }` | n/a | 정상 진행 (기존 동작) |
| `{ verified: false }` (WRONG code) | n/a | `BadRequestException` (기존 동작) |
| `GoneException` (EXPIRED/NO_MORE_ATTEMPTS) | `true` | **정상 진행 (이번 hotfix 의 새 분기)** |
| `GoneException` | `false` | `GoneException` re-throw (실제 만료 보존) |
| `HttpException(429)` 등 | n/a | 그대로 propagate (기존 동작) |

## Security

- `isPhoneVerified` 는 단독 인증 수단이 아님 — `auth.service` 가 `verifyCode` 가 `GoneException` 으로 실패한 *직후* 에만 idempotency 신호로 사용. 별도 controller endpoint 로 노출 금지 (enumeration oracle).
- `verifyCode` 의 [CR-01] 보안 단언 (잘못된 코드는 항상 거부) 유지됨 — 잘못된 OTP 는 `WRONG` 결과로 `verified: false` 반환 (GoneException 아님) → fallback 미진입.
- Idempotency window: 600s (`VERIFIED_FLAG_TTL_SEC`).
- 공격 시나리오는 (a) 피해자가 직전 10분 내 인증 + (b) 피해자 휴대번호 노출 + (c) 피해자보다 먼저 register 도달 — 3 조건 동시 필요, 실질 위험 낮음 (T-260427-kch-02 accept).
- Redis 에러 로그는 e164 만 포함 (Sentry capture 미사용) — 다른 `sms.*` 로그와 동일 패턴.
- 장기 해법(WR-02 follow-up): verify-time server-bound opaque token 발행 → 이번 hotfix 범위 외, 별도 phase 로 처리.

## Verification

### Automated

```bash
$ pnpm --filter @grabit/api typecheck
> tsc --noEmit                                                       # 0 errors

$ pnpm --filter @grabit/api lint
✖ 36 problems (0 errors, 36 warnings)                                # 모두 pre-existing, 신규 0

$ pnpm --filter @grabit/api test -- sms.service auth.service
Test Files  29 passed (29)
      Tests  315 passed (315)                                        # sms 67/67, auth 28/28
```

신규 케이스 8 개 모두 통과:
- sms.service.spec.ts > isPhoneVerified > production flag '1' → true
- sms.service.spec.ts > isPhoneVerified > production flag null → false
- sms.service.spec.ts > isPhoneVerified > dev mock → false (Redis 미호출)
- sms.service.spec.ts > isPhoneVerified > Redis 실패 → false (fail closed)
- auth.service.spec.ts > register > [hotfix 260427-kch] GoneException + isPhoneVerified true → 정상 가입
- auth.service.spec.ts > register > [hotfix 260427-kch] GoneException + isPhoneVerified false → 410 propagate
- auth.service.spec.ts > completeSocialRegistration > [hotfix 260427-kch] GoneException + isPhoneVerified true → 정상 가입
- auth.service.spec.ts > completeSocialRegistration > [hotfix 260427-kch] GoneException + isPhoneVerified false → 410 propagate

### Manual scenarios (deploy 후 main 에서 검증)

| # | 시나리오 | 기대 결과 |
|---|---|---|
| a | 신규 이메일 가입: 휴대폰 인증 → "가입완료" | 200 + 자동 로그인 + 메인으로 리다이렉트 (이전: 410) |
| b | 카카오/네이버/구글 소셜 가입: OAuth → 휴대폰 인증 → "가입완료" | 200 + 자동 로그인 (이전: 410) |
| c | 실제 만료 케이스: OTP 발송 후 11분 (≥600s + 여유) 대기 → "가입완료" | 410 정상 발생 + UI "인증번호가 만료되었습니다. 재발송해주세요" 표시 — 안 보이면 이번 패치가 너무 관대한 것이므로 재검토 |
| d | (회귀) 잘못된 OTP 6자리 입력 → "가입완료" | 400 BadRequest "전화번호 인증이 완료되지 않았습니다" — verified flag 가 켜진 다른 폰이라도 이 케이스는 거부되어야 함 (CR-01) |

## Hotfix deploy plan

1. **PR**: 별도 hotfix 브랜치 권장 (현 worktree 의 `gsd/phase-15-resend-heygrabit-cutover` 와 분리). Phase 15 머지와 독립적으로 main 으로 직행.
   - 변경 범위: 4 파일 (`apps/api/src/modules/sms/*`, `apps/api/src/modules/auth/*`)
   - Phase 15 (Resend / email 영역) 와 파일 충돌 없음
2. **Cloud Run 배포**: `api` 서비스만 재배포로 충분 (web 변경 없음). `web` 은 routing 일관성을 위해 같이 redeploy 해도 무방하나 필수 아님.
3. **Post-deploy verification**: 위 manual scenarios a/b/c/d 4 건 즉시 확인.
4. **모니터링**: Sentry 에서 `GoneException` (HTTP 410) 발생률 추적 — 정상 케이스에서는 거의 0 이어야 함 (실제 만료만 카운트). Cloud Logging 에서 신규 이벤트 `sms.is_phone_verified_failed` 의 빈도 확인 (Redis 안정성 시그널).

## Follow-up

- **WR-02 (server-bound opaque token)**: `sms.service.ts:401-403` 주석에 명시된 장기 해법. verify-time 에 서버에서 phone-bound opaque token 을 발행하고, downstream endpoint (register / password-reset / etc.) 에서 그 token 을 요구하도록 변경. 이번 hotfix 범위 외 — 별도 Phase (Phase 18 후보) 로 추진.
- **프론트엔드 sync**: 이번 백엔드 hotfix 는 프론트의 "verify → register 두 번 호출" 패턴을 그대로 수용함. 만약 프론트도 함께 수정한다면 `/sms/verify-code` 응답에 server-bound token 을 받아 `/auth/register` 에 전달하는 형태가 되어 backend WR-02 와 짝을 이룬다.

## Self-Check: PASSED

- File `apps/api/src/modules/sms/sms.service.ts` exists — `isPhoneVerified` method present.
- File `apps/api/src/modules/auth/auth.service.ts` exists — `assertPhoneVerified` private helper + `GoneException` import present.
- File `apps/api/src/modules/sms/sms.service.spec.ts` exists — `describe('isPhoneVerified', ...)` present.
- File `apps/api/src/modules/auth/auth.service.spec.ts` exists — `[hotfix 260427-kch]` test cases present.
- Commit `5e04228` (Task 1) found in `git log`.
- Commit `5df4203` (Task 2) found in `git log`.
- typecheck PASS / lint PASS (0 errors) / tests 315/315 PASS.

## Next steps for user

```bash
# 1. Diff 검토
git diff main..HEAD -- apps/api/src/modules/sms/sms.service.ts apps/api/src/modules/auth/auth.service.ts

# 2. (옵션) hotfix 브랜치로 cherry-pick — Phase 15 작업과 독립 deploy 시
git checkout main
git checkout -b hotfix/410-expired-register
git cherry-pick 5e04228 5df4203

# 3. PR open + main 머지 → Cloud Run api 자동 재배포 (deploy.yml)
# 4. Post-deploy: SUMMARY.md "Manual scenarios" a/b/c/d 4 건 즉시 확인
# 5. Sentry 모니터링: 1 시간 동안 410 발생률 모니터, 정상 가입에서 0 인지 확인
```
