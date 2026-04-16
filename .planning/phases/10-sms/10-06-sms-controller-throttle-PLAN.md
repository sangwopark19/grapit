---
phase: 10
plan: 06
type: execute
wave: 3
depends_on: [10-05]
files_modified:
  - apps/api/src/modules/sms/sms.controller.ts
autonomous: true
requirements: [SMS-01, SMS-02, SMS-04]
must_haves:
  truths:
    - "sms.controller.ts의 send-code 엔드포인트가 IP axis 20/3600s @Throttle 적용 (D-06 IP 축)"
    - "sms.controller.ts의 verify-code 엔드포인트가 IP axis 10/900s @Throttle 적용 (D-07 IP 축 — 동일 IP multi-phone brute-force 방어선)"
    - "phone axis 카운터(D-06 phone 5/3600s, D-07 phone 10/900s)는 SmsService 레이어(Plan 05 Task 3, `sms:send_count:{e164}` / `sms:verify_count:{e164}` Valkey INCR)에서 실제 구현됨 — 본 plan 범위 외이나 전체 계약의 절반"
    - "zod schema가 한국 로컬 번호와 E.164 국제 번호를 모두 수용 (태국/홍콩 등 다국적 지원, +86 제외는 서비스 레이어 책임)"
    - "controller 응답 shape 불변 (SendResult / VerifyResult)"
    - "Infobip 서비스 예외 매핑이 유지되어 400/410/429 상태코드가 프론트에 올바르게 전달"
  artifacts:
    - path: "apps/api/src/modules/sms/sms.controller.ts"
      provides: "@Throttle named throttler 적용 + zod schema 국제 번호 수용"
      contains: "@Throttle"
  key_links:
    - from: "sms.controller.ts"
      to: "@nestjs/throttler"
      via: "@Throttle({ default: { limit, ttl } }) v6 object signature"
      pattern: "@Throttle\\("
    - from: "sms.controller.ts"
      to: "SmsService"
      via: "sendVerificationCode / verifyCode 호출 (응답 계약 불변)"
      pattern: "sendVerificationCode|verifyCode"
    - from: "sms.controller.ts"
      to: "ZodValidationPipe"
      via: "sendCodeSchema / verifyCodeSchema"
      pattern: "ZodValidationPipe"
---

<objective>
SMS controller에 `@Throttle` 데코레이터를 추가하고 zod schema를 국제 번호(태국, 기타)까지 수용하도록 확장한다. 본 plan은 **IP axis**만 담당 — send-code 20/3600s, verify-code 10/900s. **phone axis는 Plan 05 Task 3(T-phone-axis-counters)이 SmsService 내부 Valkey INCR+EXPIRE로 실 구현** (RESEARCH Open Question #1 **RESOLVED** (b)). RESEARCH §"Code Examples > Controller throttler decorators"를 그대로 따르되, Plan 05 SmsService 재작성 후 응답 shape 불변인지 최종 확인.

Purpose: SMS-01의 rate limiting 실현은 2-axis × 2-layer 조합:
- **Controller IP axis (본 Plan 06)**: send 20/3600s + verify 10/900s — 단일 IP에서 multi-phone brute-force 방어 + 비용 방어 표면
- **Service phone axis (Plan 05 T3)**: send 5/3600s + verify 10/900s — 단일 phone에서 multi-IP/다중 클라이언트 방어
- Plan 07 ThrottlerModule Valkey storage가 Cloud Run 멀티 인스턴스 분산 카운팅 보장

Output: `apps/api/src/modules/sms/sms.controller.ts` (수정).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/10-sms/10-CONTEXT.md
@.planning/phases/10-sms/10-RESEARCH.md
@apps/api/src/modules/sms/sms.controller.ts
@apps/api/src/modules/auth/auth.controller.ts

<interfaces>
# 기존/신규 contracts

```typescript
// @nestjs/throttler v6 object signature (CONFIRMED from auth.controller.ts:120, 133)
import { Throttle } from '@nestjs/throttler';

@Throttle({ default: { limit: 3, ttl: 900_000 } })  // 3 req / 15 min / IP
// ^-- v6 object signature, ttl = 900_000ms = 15min, NOT 900s

// SmsService (Plan 05에서 재작성됨)
interface SendResult { success: boolean; message: string }
interface VerifyResult { verified: boolean; message?: string }

// zod (project-wide standard, class-validator 금지)
import { z } from 'zod';

// RESEARCH Pattern 3 / Open Question #1 **RESOLVED** (b):
// IP 축 (본 plan 06) → @Throttle 데코레이터 (기본 tracker가 IP). send 20/3600s + verify 10/900s
// phone 축 (Plan 05 Task 3) → SmsService 내부에서 Valkey INCR + EXPIRE
//   - sms:send_count:{e164} 5/3600s (D-06 phone axis)
//   - sms:verify_count:{e164} 10/900s (D-07 phone axis)
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <id>10-06-T1</id>
  <name>Task 1: send-code / verify-code에 @Throttle 적용 + zod schema 국제 번호 수용</name>
  <files>apps/api/src/modules/sms/sms.controller.ts</files>
  <behavior>
    - sendCode 엔드포인트에 `@Throttle({ default: { limit: 20, ttl: 60 * 60 * 1000 } })` (IP 20/h, D-06)
    - verifyCode 엔드포인트에 `@Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })` (IP/phone 혼합 tracker, D-07)
    - zod sendCodeSchema가 한국 로컬(`^01[016789]\d{7,8}$`) OR E.164 국제(`^\+[1-9]\d{6,14}$`) 둘 다 허용
    - verifyCodeSchema는 기존 유지 (phone + 6자리 code)
    - SmsService 응답 shape 불변 → controller 반환 타입 그대로
  </behavior>
  <read_first>
    - apps/api/src/modules/sms/sms.controller.ts (기존 zod schema + @Public + ZodValidationPipe 구조)
    - apps/api/src/modules/auth/auth.controller.ts:118-135 (@Throttle v6 object signature 패턴 참조)
    - .planning/phases/10-sms/10-CONTEXT.md D-06, D-07
    - .planning/phases/10-sms/10-RESEARCH.md §"Code Examples > Controller throttler decorators"
    - .planning/phases/10-sms/10-RESEARCH.md §"Common Pitfalls > Pitfall 1" (v6 시그니처 혼용)
    - .planning/phases/10-sms/10-RESEARCH.md §"Open Questions > #1" (phone tracker 결정)
  </read_first>
  <action>
    **Step 1: `@nestjs/throttler`에서 Throttle import 추가.**
    ```typescript
    import { Throttle } from '@nestjs/throttler';
    ```

    **Step 2: sendCodeSchema zod 국제 번호 수용으로 확장** (기존 한국 전용 regex만 있음):
    ```typescript
    const sendCodeSchema = z.object({
      phone: z.string().regex(
        /^(01[016789]\d{7,8}|\+[1-9]\d{6,14})$/,
        '올바른 휴대폰 번호를 입력해주세요',
      ),
    });
    ```
    근거: RESEARCH §"Existing Code Insights > Reusable Assets" — 기존 regex는 한국 특화. 태국 등 국제 번호 지원 필요. E.164 상한 15자리(ITU-T E.164 표준). Infobip 서버 측에서도 최종 검증되지만 zod에서 1차 방어.

    **Step 3: sendCode에 `@Throttle` 데코레이터 추가** (@Public, @HttpCode, @Post 데코레이터와 함께 스택):
    ```typescript
    @Public()
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 20, ttl: 60 * 60 * 1000 } })
    // D-06 IP axis: 20 req/3600s/IP. phone axis(5/3600s)는 SmsService Task 3에서 sms:send_count:{e164} INCR로 별도 구현
    // v6 object signature, ttl = 3_600_000ms = 1h, NOT 3600s
    @Post('send-code')
    async sendCode(/* ... */) { /* 변경 없음 */ }
    ```

    **Step 4: verifyCode에 `@Throttle` 데코레이터 추가**:
    ```typescript
    @Public()
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
    // D-07 IP axis: 10 req/900s/IP. phone axis(10/900s)는 SmsService Task 3에서 sms:verify_count:{e164} INCR로 별도 구현
    // Infobip pinAttempts=5와 multi-layer defense-in-depth
    // v6 object signature, ttl = 900_000ms = 15min, NOT 900s
    @Post('verify-code')
    async verifyCode(/* ... */) { /* 변경 없음 */ }
    ```

    **Step 5: 기존 controller 로직/응답 shape 불변** — `this.smsService.sendVerificationCode(dto.phone)` 호출, `this.smsService.verifyCode(dto.phone, dto.code)` 호출 그대로. 응답 타입 `SendResult` / `VerifyResult` 변경 없음 (auth.service.ts:71 destructure 호환성 유지, RESEARCH Assumption A8).

    **주의사항:**
    - Throttle의 TTL은 ms 단위 (v6 차이점 — RESEARCH Pitfall 1)
    - 본 plan은 **IP axis 전용**. phone axis는 `@Throttle` 기본 getTracker(IP)로는 구현 불가능하므로 Plan 05 Task 3이 SmsService `sendVerificationCode` / `verifyCode` 내부에서 Valkey INCR+EXPIRE(`sms:send_count:{e164}` / `sms:verify_count:{e164}`)로 실 구현 — 본 plan에서 phone tracker 커스텀 Guard 금지(복잡도 과잉)
    - Plan 07이 ThrottlerModule storage를 Valkey로 바꾸면 본 decorator들(IP axis)은 자동으로 분산 카운팅 획득. phone axis는 이미 Plan 05 시점에서 Valkey 직접 사용으로 분산 보장
    - SmsService가 throw하는 BadRequestException(429 — resend cooldown 또는 phone axis) / GoneException(410) / BadRequestException(400 CN)은 HttpExceptionFilter로 통과 → 프론트에서 D-20 에러 분기

    **로컬 환경 주의:** `REDIS_URL` 미설정 local dev에서 throttler가 in-memory로 동작하면 괜찮지만 Plan 07이 forRootAsync로 변경 후 InMemoryRedis와 비호환 가능성 있음 — 이는 Plan 07 책임.
  </action>
  <acceptance_criteria>
    - `grep -c "@Throttle" apps/api/src/modules/sms/sms.controller.ts` == 2
    - `grep -q "import { Throttle } from '@nestjs/throttler'" apps/api/src/modules/sms/sms.controller.ts`
    - `grep -q "limit: 20" apps/api/src/modules/sms/sms.controller.ts` (send IP 20/h)
    - `grep -q "60 \* 60 \* 1000\|3600000\|3_600_000" apps/api/src/modules/sms/sms.controller.ts` (1시간 ms)
    - `grep -q "limit: 10" apps/api/src/modules/sms/sms.controller.ts` (verify 10/15min)
    - `grep -q "15 \* 60 \* 1000\|900000\|900_000" apps/api/src/modules/sms/sms.controller.ts` (15분 ms)
    - `grep -qE '\^\(01\[016789\]\\d\{7,8\}\|\\\+\[1-9\]\\d\{6,14\}\)\$' apps/api/src/modules/sms/sms.controller.ts` (국제 번호 regex)
    - `pnpm --filter @grapit/api typecheck` exits 0
    - `pnpm --filter @grapit/api lint --max-warnings 0 src/modules/sms/sms.controller.ts` exits 0
  </acceptance_criteria>
  <verify>
    <automated>pnpm --filter @grapit/api test sms -- --run</automated>
  </verify>
  <requirements>SMS-01, SMS-02, SMS-04</requirements>
  <autonomous>true</autonomous>
  <commit>feat(10-06): add @Throttle decorators to sms controller (per D-06, D-07)</commit>
  <done>send-code/verify-code 둘 다 @Throttle 적용, 국제 번호 regex 확장, typecheck/lint green, SmsService 응답 shape 불변</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| anonymous client → /sms/* | JWT 미요구 endpoint, rate limit과 zod가 1차 방어 |
| controller → SmsService | 정규화된 phone + code 전달, SmsService가 CN 차단/pin 상태 판정 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-06-01 | Tampering | send-code endpoint (SMS pumping / premium-rate fraud, HIGH) | mitigate | **본 plan**: `@Throttle({ default: { limit: 20, ttl: 3_600_000 } })` IP axis 20/3600s. **Plan 05 Task 3** (T-phone-axis-counters): SmsService `sms:send_count:{e164}` INCR 5/3600s phone axis. **Plan 05 Task 1**: Valkey `sms:resend:{e164}` SET NX 30s cooldown + Infobip `sendPinPerPhoneNumberLimit=5/1h`. 4-layer defense |
| T-10-06-02 | Tampering | verify-code endpoint (Brute-force OTP guessing, HIGH) | mitigate | **본 plan**: `@Throttle({ default: { limit: 10, ttl: 900_000 } })` IP axis 10/900s. **Plan 05 Task 3**: SmsService `sms:verify_count:{e164}` INCR 10/900s phone axis (multi-IP bypass 방어). **Infobip Application** `pinAttempts=5` — 3-layer |
| T-10-06-03 | Information Disclosure | send-code response (OTP enumeration) | accept | Phase 10 SMS는 register 전 호출로 enumeration 표면 작음. 응답 메시지는 phone 등록 여부 무관하게 동일 |
| T-10-06-04 | Input Validation bypass | sendCodeSchema (zod) | mitigate | regex `^(01[016789]\d{7,8}|\+[1-9]\d{6,14})$` — 한국 로컬 + E.164만 허용, 악성 입력 차단 |
| T-10-06-05 | Tampering | CSRF on send-code (rate cost 소모) | accept | anonymous endpoint, credentials 없음. IP throttle이 방어 표면 제공 |
</threat_model>

<verification>
- `pnpm --filter @grapit/api typecheck` green
- `pnpm --filter @grapit/api lint` green (변경 파일 warning 0)
- `pnpm --filter @grapit/api test sms -- --run` green (Plan 05에서 GREEN 전환된 sms.service.spec.ts 유지)
- `grep -c '@Throttle' apps/api/src/modules/sms/sms.controller.ts` == 2
</verification>

<success_criteria>
- SmsController가 `@Throttle` IP axis 2곳 적용 (send 20/3600s, verify 10/900s)
- **phone axis 구현은 본 plan scope 외 — Plan 05 Task 3이 SmsService 내부 Valkey INCR로 실 구현** (허위 위임 주장 금지)
- zod regex가 한국 + 국제 E.164 둘 다 수용
- SmsService 응답 shape 불변으로 auth.service 호출부 무영향
- v6 object signature + ms 단위 TTL 정확
- CONTEXT D-06 IP axis / D-07 IP axis (phone axis는 Plan 05, storage 분산은 Plan 07) 반영
</success_criteria>

<output>
After completion, create `.planning/phases/10-sms/10-06-SUMMARY.md` with:
- 적용된 throttle 설정값 요약
- zod regex 변경 diff
- Plan 07이 Valkey storage 붙이기 전까지 throttler는 in-memory 동작 (주의 사항 기록)
</output>
