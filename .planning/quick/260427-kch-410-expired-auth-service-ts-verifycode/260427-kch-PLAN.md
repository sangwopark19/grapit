---
plan_id: 260427-kch
status: pending
type: execute
mode: quick
description: "회원가입 가입완료 시 410 EXPIRED 에러 수정 (auth.service.ts verifyCode 이중 호출 → idempotent re-verify 처리)"
branch: gsd/phase-15-resend-heygrabit-cutover
deploy_target: "main (hotfix merge)"
files_modified:
  - apps/api/src/modules/sms/sms.service.ts
  - apps/api/src/modules/auth/auth.service.ts
  - apps/api/src/modules/sms/sms.service.spec.ts
  - apps/api/src/modules/auth/auth.service.spec.ts
autonomous: true
must_haves:
  truths:
    - "이메일 회원가입: 프론트가 /sms/verify-code 로 OTP 검증 후 /auth/register 호출하면 410 없이 성공"
    - "소셜 회원가입: completeSocialRegistration 도 동일하게 410 없이 성공"
    - "verified flag(`{sms:{e164}}:verified`, TTL 600s) 가 없으면 410 GoneException 그대로 클라이언트로 전파 (실제 만료 케이스 보존)"
    - "잘못된 OTP 입력 시 verifyCode 의 [CR-01] 보안 단언이 깨지지 않음 (verifyCode 가 throw 한 직후에만 verified flag 조회)"
  artifacts:
    - path: "apps/api/src/modules/sms/sms.service.ts"
      provides: "신규 메서드 isPhoneVerified(phone): Promise<boolean>"
      contains: "isPhoneVerified"
    - path: "apps/api/src/modules/auth/auth.service.ts"
      provides: "register + completeSocialRegistration 에서 GoneException catch → isPhoneVerified fallback"
      contains: "isPhoneVerified"
    - path: "apps/api/src/modules/sms/sms.service.spec.ts"
      provides: "isPhoneVerified 3 케이스 (flag '1' / null / dev mock)"
    - path: "apps/api/src/modules/auth/auth.service.spec.ts"
      provides: "register + completeSocialRegistration 회귀 방지 테스트 (각 2 신규 케이스)"
  key_links:
    - from: "apps/api/src/modules/auth/auth.service.ts (register, completeSocialRegistration)"
      to: "apps/api/src/modules/sms/sms.service.ts (isPhoneVerified)"
      via: "GoneException catch fallback"
      pattern: "isPhoneVerified.*phoneVerified"
    - from: "apps/api/src/modules/sms/sms.service.ts (isPhoneVerified)"
      to: "Redis: smsVerifiedKey(e164)"
      via: "this.redis.get(smsVerifiedKey(e164))"
      pattern: "redis\\.get\\(smsVerifiedKey"
---

<objective>
회원가입 마지막 단계에서 410 EXPIRED 에러로 인해 가입 자체가 차단되는 버그를 수정한다.

**Root cause** (사전 조사 완료, planning_context 참조):
프론트엔드가 `POST /api/v1/sms/verify-code` 로 OTP 를 한 번 검증해 OTP 키(`{sms:{e164}}:otp`)를 DEL 한 직후, `POST /api/v1/auth/register` 가 같은 OTP 로 `verifyCode()` 를 다시 호출 → Lua 스크립트가 OTP 키를 못 찾아 `EXPIRED` 반환 → `GoneException` throw. 결과: 정상 사용자가 가입 완료 시 410 을 받음.

**Fix**: `SmsService` 자체 주석(`sms.service.ts:385-403`)이 명시한 권고를 따른다 — `{sms:{e164}}:verified` 플래그(TTL 600s)를 idempotency 신호로 활용하기 위한 `isPhoneVerified(phone)` 메서드를 추가하고, `auth.service.ts` 의 두 회원가입 경로(`register`, `completeSocialRegistration`)에서 `verifyCode` 가 `GoneException` 으로 실패한 *직후* 에만 fallback 으로 호출한다.

Purpose: 정상 사용자가 회원가입을 완료할 수 있게 하면서, OTP 미발급/실제 만료/잘못된 코드는 여전히 거부.

Output:
- `SmsService.isPhoneVerified(phone): Promise<boolean>` (신규)
- `register()` + `completeSocialRegistration()` 의 phone-verify 블록 패치
- vitest 회귀 방지 테스트 (sms.service.spec.ts 3건, auth.service.spec.ts 4건)
- typecheck / lint / 해당 spec 파일 그린

**Branch context**: `gsd/phase-15-resend-heygrabit-cutover` worktree 에서 작업, 머지 후 main 핫픽스 배포. 변경 범위는 위 4개 파일로 한정 — Phase 15 Resend 작업과 파일 충돌 없음.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@apps/api/src/modules/sms/sms.service.ts
@apps/api/src/modules/auth/auth.service.ts
@apps/api/src/modules/sms/sms.service.spec.ts
@apps/api/src/modules/auth/auth.service.spec.ts

<interfaces>
<!-- 핵심 contract — 실행자가 별도 codebase 탐색 없이 바로 사용 -->

From apps/api/src/modules/sms/sms.service.ts:
```typescript
// 이미 export 되어 있음
export const smsVerifiedKey = (e164: string): string => { /* asserts E164 */ return `{sms:${e164}}:verified`; };
export interface VerifyResult { verified: boolean; message?: string }

// 이미 import 되어 있음
import { GoneException, HttpException, HttpStatus, Injectable, Logger, BadRequestException } from '@nestjs/common';

// 이미 사용 중인 helper (sms.service.ts 내부)
//   private parseE164(phone: string): string  → libphonenumber 정규화
//   this.isDevMock: boolean
//   this.redis: Upstash Redis 클라이언트 (HTTP)
//   this.logger: NestJS Logger
```

From apps/api/src/modules/auth/auth.service.ts (수정 대상 두 위치):
```typescript
// register() — line 71
const verifyResult = await this.smsService.verifyCode(dto.phone, dto.phoneVerificationCode);
if (!verifyResult.verified) {
  throw new BadRequestException('전화번호 인증이 완료되지 않았습니다');
}

// completeSocialRegistration() — line 393
const verifyResult = await this.smsService.verifyCode(dto.phone, dto.phoneVerificationCode);
if (!verifyResult.verified) {
  throw new BadRequestException('전화번호 인증이 완료되지 않았습니다');
}

// 이미 import 되어 있음 (확인 필요 — 없으면 추가)
import { BadRequestException, ConflictException, UnauthorizedException, ... } from '@nestjs/common';
// ⚠️ GoneException 은 신규 import 필요 — Task 1 에서 추가
```

From apps/api/src/modules/auth/auth.service.spec.ts:
```typescript
// 기존 mock pattern (line 136) — verifyCode 모킹은 이미 존재
mockSmsService = {
  sendVerificationCode: vi.fn().mockResolvedValue({ success: true, message: '...' }),
  verifyCode: vi.fn().mockResolvedValue({ verified: true }),
};
// 신규 모킹 필요: isPhoneVerified: vi.fn().mockResolvedValue(false)
```
</interfaces>

<bug_analysis_reference>
사전 조사 결과는 `<bug_analysis_already_completed>` (planning_context) 참조.
재조사 금지 — 위 분석 신뢰하고 구현/테스트만 진행.
</bug_analysis_reference>

<security_notes>
- `isPhoneVerified` 는 단독 인증 수단이 아님 — auth.service 가 verifyCode 가 `GoneException` 으로 실패한 *직후* 에만 idempotency 신호로 사용
- 별도 controller endpoint 로 노출 금지 (enumeration oracle)
- verifyCode 의 `[CR-01]` 보안 단언 (잘못된 코드는 항상 거부) 유지됨 — verifyCode 가 throw 한 후에만 flag 조회하므로
- Idempotency window: 600s (10분, `VERIFIED_FLAG_TTL_SEC`)
- 공격 시나리오: (a) 피해자가 직전 10분 내 인증 + (b) 피해자 휴대번호 노출 + (c) 피해자보다 먼저 register 도달 — 3 조건 모두 필요, 실질 위험 낮음
- 장기 해법(WR-02 follow-up): verify-time server-bound opaque token 발행 → 이번 hotfix 범위 외
</security_notes>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: SmsService.isPhoneVerified() 추가 + AuthService 두 회원가입 경로 패치</name>
  <files>
    apps/api/src/modules/sms/sms.service.ts,
    apps/api/src/modules/auth/auth.service.ts
  </files>
  <behavior>
    SmsService.isPhoneVerified(phone):
    - dev mock 모드(this.isDevMock === true): false 반환 (dev 흐름은 verifyCode '000000' 으로 success 처리되므로 fallback 불필요)
    - production: parseE164(phone) → this.redis.get(smsVerifiedKey(e164)) → 결과가 '1' 이면 true, 아니면 false
    - parseE164 가 throw 하면 그대로 propagate (잘못된 phone 입력은 호출자가 처리)
    - Redis 에러 시: warn 로그 + false 반환 (안전 fallback — 가짜 통과 방지)

    AuthService.register() / completeSocialRegistration():
    - verifyCode SUCCESS → 기존대로 진행
    - verifyCode 가 GoneException throw → isPhoneVerified(dto.phone) 호출 → true 면 정상 진행, false 면 GoneException 그대로 re-throw
    - 그 외 에러는 그대로 propagate
    - verifyResult.verified === false (WRONG code) → 기존대로 BadRequestException
  </behavior>
  <action>
    **Step A — `apps/api/src/modules/sms/sms.service.ts` 에 메서드 추가:**

    클래스 내부 (verifyCode 메서드 바로 아래, 파일 끝 `}` 직전)에 추가:

    ```typescript
    /**
     * [hotfix 260427-kch] Idempotency probe for downstream consumers.
     *
     * After a successful verifyCode() call the OTP key is DEL'd, so a second
     * verifyCode() with the same code returns EXPIRED (GoneException). Per the
     * design note above verifyCode (sms.service.ts:385-403), the
     * `{sms:{e164}}:verified` flag (TTL 600s) is left behind specifically so
     * downstream consumers can probe "this phone was verified within the last
     * 10 min" WITHOUT re-running the Lua script.
     *
     * SECURITY: This is NOT an authentication primitive. Callers MUST only
     * consult this AFTER verifyCode() has thrown GoneException. Calling this
     * standalone (or wiring it to a controller) reintroduces the [CR-01]
     * impersonation primitive that was removed when the verify-flag
     * short-circuit was deleted from verifyCode itself.
     *
     * Returns false in dev-mock mode — the dev flow uses the '000000'
     * fast-path inside verifyCode and does not need this fallback.
     */
    async isPhoneVerified(phone: string): Promise<boolean> {
      if (this.isDevMock) return false;
      const e164 = this.parseE164(phone);
      try {
        const flag = await this.redis.get<string>(smsVerifiedKey(e164));
        return flag === '1';
      } catch (err) {
        // Fail closed: a Valkey blip should not let a request slip through
        // unverified. The caller will re-throw the original GoneException.
        this.logger.warn({
          event: 'sms.is_phone_verified_failed',
          phone: e164,
          err: (err as Error).message,
        });
        return false;
      }
    }
    ```

    ⚠️ 주의:
    - `parseE164` 는 `private` 메서드일 가능성 — sms.service.ts 의 verifyCode 가 어떻게 호출하는지 확인하고 동일 패턴 사용 (이미 `verifyCode` 내부에서 `this.parseE164(phone)` 사용 중이면 그대로 사용)
    - `this.redis.get<string>` 의 타입이 다르면 sms.service.ts 의 다른 redis.get 호출을 참고하여 동일한 시그니처로 작성
    - `smsVerifiedKey` 는 동일 파일 상단에 이미 export 되어 있음 — 새로 import 불필요

    **Step B — `apps/api/src/modules/auth/auth.service.ts` 수정:**

    1. 파일 상단 import 에 `GoneException` 추가:
       ```typescript
       import {
         BadRequestException,
         ConflictException,
         GoneException,  // ← 추가
         UnauthorizedException,
         // ...기존 그대로
       } from '@nestjs/common';
       ```
       (이미 GoneException 이 import 되어 있으면 skip)

    2. `register()` (line 69 부근) 의 phone-verify 블록을 다음으로 교체:

       ```typescript
       async register(dto: RegisterBody): Promise<AuthResult> {
         // 0. Verify phone number — handle idempotent re-verify after the
         // frontend already called /sms/verify-code (OTP key was DEL'd, so
         // verifyCode now returns EXPIRED). Per sms.service.ts:385-403,
         // fall back to the {sms:{e164}}:verified flag (TTL 600s).
         await this.assertPhoneVerified(dto.phone, dto.phoneVerificationCode);

         // 1. Check email uniqueness  ... (이하 기존 로직 그대로)
       ```

    3. `completeSocialRegistration()` (line 386 부근) 의 phone-verify 블록도 동일하게 교체:

       ```typescript
       async completeSocialRegistration(
         registrationToken: string,
         dto: SocialRegisterBody,
       ): Promise<AuthResult> {
         this.logger.log('completeSocialRegistration: started');

         // 0. Verify phone number — see register() for rationale
         await this.assertPhoneVerified(dto.phone, dto.phoneVerificationCode);

         // 1. Verify registrationToken JWT  ... (이하 기존 로직 그대로)
       ```

    4. AuthService 클래스 내부에 private helper 추가 (DRY — 두 호출자 공유):

       ```typescript
       /**
        * [hotfix 260427-kch] Verify phone with idempotency fallback.
        * The frontend already calls POST /sms/verify-code before /auth/register
        * (or completeSocialRegistration) and the SmsService Lua script DEL's
        * the OTP key on success. Re-running verifyCode therefore throws
        * GoneException for the legitimate user. We catch that one specific
        * exception and fall back to the verified-flag set by the original
        * verify call (TTL 600s, see sms.service.ts:385-403). True expiry
        * (no flag) still bubbles 410 to the client.
        */
       private async assertPhoneVerified(phone: string, code: string): Promise<void> {
         try {
           const verifyResult = await this.smsService.verifyCode(phone, code);
           if (!verifyResult.verified) {
             throw new BadRequestException('전화번호 인증이 완료되지 않았습니다');
           }
         } catch (err) {
           if (err instanceof GoneException) {
             const alreadyVerified = await this.smsService.isPhoneVerified(phone);
             if (!alreadyVerified) throw err;  // truly expired — propagate 410
             return;
           }
           throw err;
         }
       }
       ```

    helper 위치: `register()` 메서드 바로 위 또는 클래스 끝 (private 메서드 모음 영역) — 코드베이스 컨벤션 따르기.
  </action>
  <verify>
    <automated>pnpm --filter @grabit/api typecheck && pnpm --filter @grabit/api lint</automated>
  </verify>
  <done>
    - `apps/api/src/modules/sms/sms.service.ts` 에 `isPhoneVerified` public async 메서드 존재
    - `apps/api/src/modules/auth/auth.service.ts` 에 `assertPhoneVerified` private async 메서드 존재
    - register / completeSocialRegistration 의 phone-verify 라인이 `await this.assertPhoneVerified(dto.phone, dto.phoneVerificationCode);` 한 줄로 교체됨
    - `GoneException` import 존재
    - typecheck / lint 통과 (warning 있어도 기존과 동일하면 OK, 신규 warning 발생 시 fix)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: vitest 회귀 방지 테스트 추가 (sms + auth)</name>
  <files>
    apps/api/src/modules/sms/sms.service.spec.ts,
    apps/api/src/modules/auth/auth.service.spec.ts
  </files>
  <behavior>
    sms.service.spec.ts — `describe('isPhoneVerified', ...)` 신규 블록 (verifyCode describe 바로 아래):
    - "production 에서 {sms:{e164}}:verified flag = '1' 이면 true"
    - "production 에서 flag null 이면 false"
    - "dev mock 모드에서는 항상 false 반환 (Redis 호출 없음)"

    auth.service.spec.ts — 기존 register / completeSocialRegistration describe 안에 추가:
    - register: "verifyCode 가 GoneException, isPhoneVerified true → 정상 가입 (회귀 방지)"
    - register: "verifyCode 가 GoneException, isPhoneVerified false → 410 GoneException propagate"
    - completeSocialRegistration: 동일한 2 케이스
  </behavior>
  <action>
    **Step A — `apps/api/src/modules/sms/sms.service.spec.ts`:**

    파일 내 `describe('verifyCode', ...)` 블록 (line 546 부근) 바로 아래에 추가:

    ```typescript
    describe('isPhoneVerified', () => {
      it('production에서 {sms:{e164}}:verified flag = "1" 이면 true 반환', async () => {
        // 기존 production-mode SmsService 인스턴스 setup 패턴 참고
        // (verifyCode 의 'Lua VERIFY_AND_INCREMENT 결과 ["VERIFIED", attempts]...' 케이스가 좋은 참고)
        const smsService = makeProdSmsService();  // 또는 기존 setup 헬퍼
        mockRedis.get = vi.fn().mockResolvedValue('1');

        const result = await smsService.isPhoneVerified('010-1234-5678');

        expect(result).toBe(true);
        expect(mockRedis.get).toHaveBeenCalledWith(expect.stringMatching(/^\{sms:\+82.*\}:verified$/));
      });

      it('production에서 flag 가 null 이면 false 반환', async () => {
        const smsService = makeProdSmsService();
        mockRedis.get = vi.fn().mockResolvedValue(null);

        const result = await smsService.isPhoneVerified('010-1234-5678');

        expect(result).toBe(false);
      });

      it('dev mock 모드에서는 Redis 호출 없이 false 반환', async () => {
        // 기존 dev-mock SmsService setup 헬퍼 사용
        const smsService = makeDevMockSmsService();
        const redisGetSpy = vi.fn();
        // mockRedis.get = redisGetSpy;  ← dev mock 도 mockRedis 공유하면 spy 부착

        const result = await smsService.isPhoneVerified('010-1234-5678');

        expect(result).toBe(false);
        expect(redisGetSpy).not.toHaveBeenCalled();
      });

      it('Redis get 실패 시 false 반환 (fail closed)', async () => {
        const smsService = makeProdSmsService();
        mockRedis.get = vi.fn().mockRejectedValue(new Error('valkey down'));

        const result = await smsService.isPhoneVerified('010-1234-5678');

        expect(result).toBe(false);
      });
    });
    ```

    ⚠️ 위 코드는 스켈레톤 — 실제 SmsService 인스턴스화 헬퍼는 기존 verifyCode 테스트(`'Lua VERIFY_AND_INCREMENT 결과 ["VERIFIED", ...]'`, line 582 부근) 패턴 그대로 복사. dev mock 모드는 line 547 (`'dev mock에서 000000 성공'`) 패턴 참조.

    **Step B — `apps/api/src/modules/auth/auth.service.spec.ts`:**

    1. mock SmsService 에 `isPhoneVerified` 추가 (line 136 부근):
       ```typescript
       mockSmsService = {
         sendVerificationCode: vi.fn().mockResolvedValue({ success: true, message: '...' }),
         verifyCode: vi.fn().mockResolvedValue({ verified: true }),
         isPhoneVerified: vi.fn().mockResolvedValue(false),  // ← 추가, 기본 false
       };
       ```
       타입 정의도 함께 업데이트:
       ```typescript
       let mockSmsService: {
         sendVerificationCode: ReturnType<typeof vi.fn>;
         verifyCode: ReturnType<typeof vi.fn>;
         isPhoneVerified: ReturnType<typeof vi.fn>;  // ← 추가
       };
       ```
       integSms (line 850) 도 동일하게:
       ```typescript
       integSms = { sendVerification: vi.fn(), verifyCode: vi.fn(), isPhoneVerified: vi.fn() };
       ```

    2. `describe('register', ...)` 블록 안에 신규 케이스 2개 추가:

       ```typescript
       it('[hotfix 260427-kch] verifyCode가 GoneException throw, isPhoneVerified true이면 정상 가입 (프론트 이중 호출 회귀 방지)', async () => {
         mockSmsService.verifyCode.mockRejectedValue(
           new GoneException('인증번호가 만료되었습니다. 재발송해주세요'),
         );
         mockSmsService.isPhoneVerified.mockResolvedValue(true);
         mockUserRepo.findByEmail.mockResolvedValue(null);
         mockUserRepo.create.mockResolvedValue({ ...mockUser, email: mockRegisterDto.email });

         const result = await authService.register(mockRegisterDto);

         expect(result.user.email).toBe(mockRegisterDto.email);
         expect(mockSmsService.isPhoneVerified).toHaveBeenCalledWith(mockRegisterDto.phone);
         expect(mockUserRepo.create).toHaveBeenCalled();
       });

       it('[hotfix 260427-kch] verifyCode가 GoneException, isPhoneVerified false이면 410 propagate (실제 만료)', async () => {
         mockSmsService.verifyCode.mockRejectedValue(
           new GoneException('인증번호가 만료되었습니다. 재발송해주세요'),
         );
         mockSmsService.isPhoneVerified.mockResolvedValue(false);

         await expect(authService.register(mockRegisterDto)).rejects.toThrow(GoneException);
         expect(mockUserRepo.create).not.toHaveBeenCalled();
       });
       ```

       `GoneException` import 추가:
       ```typescript
       import { ConflictException, GoneException, UnauthorizedException } from '@nestjs/common';
       ```

    3. `describe('completeSocialRegistration', ...)` 또는 해당 영역에 동일한 2 케이스 추가 (DTO/setup 은 기존 social-register 테스트에서 복사). 케이스 이름:
       - `[hotfix 260427-kch] verifyCode가 GoneException, isPhoneVerified true이면 정상 가입`
       - `[hotfix 260427-kch] verifyCode가 GoneException, isPhoneVerified false이면 410 propagate`
  </action>
  <verify>
    <automated>pnpm --filter @grabit/api test -- sms.service auth.service</automated>
  </verify>
  <done>
    - sms.service.spec.ts 에 `describe('isPhoneVerified', ...)` 4개 신규 it 통과
    - auth.service.spec.ts 의 register / completeSocialRegistration 에 `[hotfix 260427-kch]` 태그 it 4개 신규 통과
    - 기존 모든 테스트 (sms.service / auth.service) 회귀 없이 통과
    - 신규/기존 모두 vitest output 에 RED 없음
  </done>
</task>

<task type="auto">
  <name>Task 3: 최종 검증 + 핸드오프 노트 (typecheck/lint/test 풀세트 + 수동 시나리오 가이드)</name>
  <files>
    .planning/quick/260427-kch-410-expired-auth-service-ts-verifycode/260427-kch-SUMMARY.md
  </files>
  <action>
    **Step A — 풀 검증 명령 순차 실행:**

    ```bash
    pnpm --filter @grabit/api typecheck
    pnpm --filter @grabit/api lint
    pnpm --filter @grabit/api test -- sms.service auth.service
    ```

    하나라도 실패하면 Task 1/2 로 돌아가 수정. 모두 통과한 후에만 Step B 로 진행.

    **Step B — SUMMARY.md 작성** (`.planning/quick/260427-kch-410-expired-auth-service-ts-verifycode/260427-kch-SUMMARY.md`):

    포함 내용:
    1. **What** — 변경 파일 4개 + 한 줄 설명
    2. **Why** — 410 EXPIRED 버그의 root cause (verifyCode 이중 호출), 정상 사용자 가입 차단
    3. **How** — `isPhoneVerified` 추가 + `assertPhoneVerified` private helper 로 두 회원가입 경로 통합
    4. **Security** — `<security_notes>` 요약 (5 줄)
    5. **Verification** —
       - typecheck/lint/test 명령 + 결과
       - 수동 시나리오 가이드 (deploy 후 main 에서 검증할 항목):
         a. 신규 가입: 휴대폰 인증 → "가입완료" → 200 + 자동 로그인 확인
         b. 소셜 가입: 카카오/네이버 OAuth → 휴대폰 인증 → "가입완료" → 200 확인
         c. 실제 만료 케이스: OTP 발송 후 11분 대기 → "가입완료" → 410 정상 발생 확인 (안 보이면 이번 패치가 너무 관대한 것)
    6. **Hotfix deploy plan** — main 머지 후 Cloud Run web/api 동시 배포 (`api` 만 변경되었지만 routing 일관성을 위해 둘 다 redeploy 권장 여부 사용자 결정)
    7. **Follow-up** — sms.service.ts:401-403 주석의 WR-02 (server-bound opaque token) 는 별도 Phase 로 처리 — 이번 hotfix 범위 외

    SUMMARY.md 마지막에 **다음 커맨드 가이드** 추가:
    ```
    ## Next steps for user
    1. Review diff: git diff main -- apps/api/src/modules/sms/sms.service.ts apps/api/src/modules/auth/auth.service.ts
    2. Commit (conventional commits): fix(api/auth): handle idempotent re-verify on register (410 EXPIRED hotfix)
    3. Push + open PR against main (worktree branch: gsd/phase-15-resend-heygrabit-cutover 가 아닌 별도 hotfix 브랜치 권장)
    4. Merge → Cloud Run api 재배포 → 위 수동 시나리오 a/b/c 확인
    ```
  </action>
  <verify>
    <automated>test -f .planning/quick/260427-kch-410-expired-auth-service-ts-verifycode/260427-kch-SUMMARY.md && pnpm --filter @grabit/api test -- sms.service auth.service</automated>
  </verify>
  <done>
    - typecheck / lint / 해당 spec 그린
    - SUMMARY.md 작성 완료 (위 7 항목 포함)
    - 사용자에게 다음 단계(commit / PR / deploy) 명확히 안내
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → /api/v1/auth/register | Untrusted body (phone, phoneVerificationCode) |
| client → /api/v1/auth/social/complete-registration | Untrusted body (phone, phoneVerificationCode, registrationToken) |
| AuthService → SmsService.isPhoneVerified | Internal trust boundary — must not be bypassed by external callers |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260427-kch-01 | Spoofing | `isPhoneVerified` 단독 노출 시 verified-flag 만으로 인증 우회 가능 | mitigate | controller endpoint 미노출 + JSDoc 에 "NOT an authentication primitive" 명시 + auth.service 에서 GoneException catch 직후에만 호출 |
| T-260427-kch-02 | Elevation of Privilege | 공격자가 피해자 휴대번호로 직전 10분 idempotency window 내 register 도달 | accept | 3가지 조건 모두 필요 (인증 발생 + 번호 노출 + 선점 race), 위험 낮음. 장기 해법은 WR-02 (server-bound token) 별도 phase |
| T-260427-kch-03 | Information Disclosure | Redis 에러 메시지에 phone 누출 | mitigate | warn 로그에서 e164 만 사용 (이미 sms.service 의 다른 로그와 동일 패턴), Sentry capture 미사용 |
| T-260427-kch-04 | Tampering | 잘못된 OTP 입력에도 verified flag 가 우회 통로가 되지 않는지 | mitigate | verifyCode 의 [CR-01] 단언 유지 — verifyCode 가 throw 한 후에만 fallback 진입. 잘못된 OTP 는 `WRONG` 반환 (GoneException 아님) → fallback 미진입 |
| T-260427-kch-05 | Denial of Service | Redis 다운 시 모든 가입 시도가 실패하지 않는지 | accept | Redis 다운 시 verifyCode 자체가 이미 5xx-style fallback 처리. isPhoneVerified 도 fail-closed (false) 로 동일 동작 |

</threat_model>

<verification>
- typecheck: `pnpm --filter @grabit/api typecheck` 통과
- lint: `pnpm --filter @grabit/api lint` 통과 (신규 warning 없음)
- unit tests: `pnpm --filter @grabit/api test -- sms.service auth.service` 그린
- 회귀: 기존 verifyCode 보안 단언 ([CR-01]) 유지 — 잘못된 코드는 여전히 거부 (Task 2 spec 으로 검증)
- 코드 변경 범위: 4 파일, AuthService 두 호출 위치 + SmsService 1 메서드 + 2 spec 파일
- Phase 15 작업과 파일 충돌 없음 (sms/auth 모듈 vs phase-15 의 email/resend 영역)
</verification>

<success_criteria>
- [ ] `SmsService.isPhoneVerified(phone)` 메서드 존재 + 4 spec 케이스 그린
- [ ] `AuthService.assertPhoneVerified(phone, code)` private helper 존재
- [ ] `register()` + `completeSocialRegistration()` 둘 다 helper 호출로 교체됨
- [ ] `GoneException` import 가 auth.service.ts + auth.service.spec.ts 양쪽에 추가됨
- [ ] auth.service.spec.ts 신규 4 케이스 (`[hotfix 260427-kch]` 태그) 통과
- [ ] 기존 sms / auth spec 회귀 없음
- [ ] typecheck + lint 통과
- [ ] SUMMARY.md 작성 + commit / PR / deploy 가이드 포함
</success_criteria>

<output>
After completion, create `.planning/quick/260427-kch-410-expired-auth-service-ts-verifycode/260427-kch-SUMMARY.md`
</output>
