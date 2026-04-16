---
phase: 10
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/api/src/modules/sms/sms.service.spec.ts
  - apps/api/src/modules/sms/infobip-client.spec.ts
  - apps/api/src/modules/sms/phone.util.spec.ts
  - apps/api/test/sms-throttle.integration.spec.ts
  - apps/web/components/auth/__tests__/phone-verification.test.tsx
  - apps/web/e2e/signup-sms.spec.ts
  - apps/api/src/modules/sms/__fixtures__/infobip-send-response.json
  - apps/api/src/modules/sms/__fixtures__/infobip-verify-response.json
  - .planning/phases/10-sms/10-VALIDATION.md
autonomous: true
requirements: [SMS-01, SMS-02, SMS-03, SMS-04]
must_haves:
  truths:
    - "Wave 0 테스트 스캐폴딩이 RED 상태로 작성되어 후속 wave가 GREEN으로 전환 가능"
    - "SMS 서비스·Infobip 클라이언트·phone util·throttle integration·프론트 컴포넌트·E2E 전 영역에 실패 테스트 존재"
    - "Infobip API 응답 fixture 2종이 zod schema lock의 근거로 저장"
  artifacts:
    - path: "apps/api/src/modules/sms/sms.service.spec.ts"
      provides: "SmsService Infobip 기반 재작성 테스트 (Twilio mock 제거)"
    - path: "apps/api/src/modules/sms/infobip-client.spec.ts"
      provides: "InfobipClient fetch mock 단위 테스트"
    - path: "apps/api/src/modules/sms/phone.util.spec.ts"
      provides: "parseE164 + isChinaMainland 단위 테스트"
    - path: "apps/api/test/sms-throttle.integration.spec.ts"
      provides: "testcontainers Valkey + throttler integration 테스트"
    - path: "apps/web/components/auth/__tests__/phone-verification.test.tsx"
      provides: "phone-verification 컴포넌트 4-state/쿨다운/에러 카피 테스트"
    - path: "apps/web/e2e/signup-sms.spec.ts"
      provides: "signup SMS mock 모드 E2E flow"
    - path: "apps/api/src/modules/sms/__fixtures__/infobip-send-response.json"
      provides: "sendPin 성공 응답 fixture"
    - path: "apps/api/src/modules/sms/__fixtures__/infobip-verify-response.json"
      provides: "verifyPin 성공·실패 응답 fixture"
  key_links:
    - from: "sms.service.spec.ts"
      to: "sms.service.ts"
      via: "Plan 05에서 GREEN 전환"
      pattern: "InfobipClient|REDIS_CLIENT"
    - from: "infobip-client.spec.ts"
      to: "infobip-client.ts"
      via: "Plan 04에서 GREEN 전환"
      pattern: "App \\${apiKey}"
    - from: "sms-throttle.integration.spec.ts"
      to: "app.module.ts"
      via: "Plan 07에서 GREEN 전환"
      pattern: "ThrottlerStorageRedisService"
---

<objective>
Phase 10 실행 전 Wave 0 테스트 스캐폴딩을 완성한다. 모든 후속 plan은 이 RED 테스트들을 GREEN으로 바꾸는 작업이다. Validation.md의 "Wave 0 Requirements" 7개 파일을 모두 생성/재작성한다. CONTEXT.md D-15(`000000` dev mock), D-03(CN 차단), D-14(production hard-fail), D-11(30s cooldown), D-12(attempts exhausted), D-06/D-07(throttle limits), D-18~D-20(버튼 4-state·쿨다운·에러 카피)를 커버하는 테스트 케이스를 작성한다.

Purpose: Nyquist compliance — 각 후속 task가 자기 파일을 수정할 때 `<automated>` 명령어가 실제로 존재하고 실패→통과 전환을 관측할 수 있게 한다. 이 wave가 green일 필요는 없다(의도적 RED). 후속 plan이 GREEN으로 전환한다.

Output: 7개 테스트 파일 + 2개 fixture JSON. 프론트·백엔드·E2E·integration 전 레이어 커버.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/phases/10-sms/10-CONTEXT.md
@.planning/phases/10-sms/10-RESEARCH.md
@.planning/phases/10-sms/10-UI-SPEC.md
@.planning/phases/10-sms/10-VALIDATION.md
@apps/api/src/modules/sms/sms.service.ts
@apps/api/src/modules/sms/sms.service.spec.ts
@apps/api/src/modules/sms/sms.controller.ts
@apps/api/src/modules/booking/providers/redis.provider.ts
@apps/web/components/auth/phone-verification.tsx

<interfaces>
# 후속 plan이 작성할 계약 (테스트가 이 시그니처를 가정한다)

```typescript
// apps/api/src/modules/sms/phone.util.ts (Plan 03이 생성)
export function parseE164(input: string): string;
export function isChinaMainland(e164: string): boolean;

// apps/api/src/modules/sms/infobip-client.ts (Plan 04가 생성)
export interface InfobipSendPinResponse {
  pinId: string;
  to: string;
  ncStatus?: string;
  smsStatus?: string;
}
export interface InfobipVerifyPinResponse {
  msisdn: string;
  verified: boolean;
  attemptsRemaining: number;
  pinError?: 'NO_ERROR' | 'WRONG_PIN' | 'PIN_EXPIRED' | 'NO_MORE_PIN_ATTEMPTS' | string;
}
export class InfobipClient {
  constructor(baseUrl: string, apiKey: string, applicationId: string, messageId: string);
  sendPin(toE164: string): Promise<InfobipSendPinResponse>;
  verifyPin(pinId: string, pin: string): Promise<InfobipVerifyPinResponse>;
}
export class InfobipApiError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string);
}

// apps/api/src/modules/sms/sms.service.ts (Plan 05가 재작성)
export interface SendResult { success: boolean; message: string }
export interface VerifyResult { verified: boolean; message?: string }
export class SmsService {
  constructor(configService: ConfigService, redis: IORedis);
  sendVerificationCode(phone: string): Promise<SendResult>;
  verifyCode(phone: string, code: string): Promise<VerifyResult>;
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <id>10-01-T1</id>
  <name>Task 1: Infobip 응답 fixture JSON 2종 작성</name>
  <files>
    apps/api/src/modules/sms/__fixtures__/infobip-send-response.json,
    apps/api/src/modules/sms/__fixtures__/infobip-verify-response.json
  </files>
  <description>RESEARCH.md §"Assumptions Log" A1·A2 기반 Infobip 응답 모양을 fixture로 저장. Plan 03/04/05 테스트가 이 fixture를 `import`해서 mock 응답으로 사용한다. staging 실 호출은 D-25 수동 smoke 단계에서 zod schema lock으로 검증된다.</description>
  <read_first>
    - .planning/phases/10-sms/10-RESEARCH.md §"Assumptions Log" (A1, A2, A3)
    - .planning/phases/10-sms/10-RESEARCH.md §"Code Examples" (verifyCode 410 분기)
    - .planning/phases/10-sms/10-RESEARCH.md §"Open Questions" #3 (Infobip 응답 필드 검증)
  </read_first>
  <action>
    디렉터리 `apps/api/src/modules/sms/__fixtures__/` 생성 후 두 JSON 파일 작성:

    **infobip-send-response.json** (성공 응답)
    ```json
    {
      "pinId": "9C815F8AF3328",
      "to": "821012345678",
      "ncStatus": "NC_DESTINATION_REACHABLE",
      "smsStatus": "MESSAGE_SENT"
    }
    ```

    **infobip-verify-response.json** (복수 케이스 포함 — 테스트가 필요 필드만 골라 쓴다)
    ```json
    {
      "verified_success": {
        "msisdn": "821012345678",
        "verified": true,
        "attemptsRemaining": 4,
        "pinError": "NO_ERROR"
      },
      "wrong_pin": {
        "msisdn": "821012345678",
        "verified": false,
        "attemptsRemaining": 3,
        "pinError": "WRONG_PIN"
      },
      "expired": {
        "msisdn": "821012345678",
        "verified": false,
        "attemptsRemaining": 0,
        "pinError": "PIN_EXPIRED"
      },
      "attempts_exhausted": {
        "msisdn": "821012345678",
        "verified": false,
        "attemptsRemaining": 0,
        "pinError": "NO_MORE_PIN_ATTEMPTS"
      }
    }
    ```

    주석 금지 (JSON은 주석 불허). 이 fixture는 RESEARCH Assumptions A1/A2에 의한 추정치이며, staging 실 호출 후 필드명 변경 시 본 파일 업데이트 + 관련 테스트 assertion만 조정한다.
  </action>
  <acceptance_criteria>
    - `apps/api/src/modules/sms/__fixtures__/infobip-send-response.json` 존재하고 `JSON.parse` 가능
    - `apps/api/src/modules/sms/__fixtures__/infobip-verify-response.json` 존재
    - `grep -q '"pinId"' apps/api/src/modules/sms/__fixtures__/infobip-send-response.json`
    - `grep -q '"NO_MORE_PIN_ATTEMPTS"' apps/api/src/modules/sms/__fixtures__/infobip-verify-response.json`
    - `grep -q '"PIN_EXPIRED"' apps/api/src/modules/sms/__fixtures__/infobip-verify-response.json`
    - `grep -q '"WRONG_PIN"' apps/api/src/modules/sms/__fixtures__/infobip-verify-response.json`
    - `node -e "console.log(Object.keys(require('./apps/api/src/modules/sms/__fixtures__/infobip-verify-response.json')))"` 출력에 `verified_success`, `wrong_pin`, `expired`, `attempts_exhausted` 모두 포함
  </acceptance_criteria>
  <verify>
    <automated>node -e "const a=require('./apps/api/src/modules/sms/__fixtures__/infobip-send-response.json'); const b=require('./apps/api/src/modules/sms/__fixtures__/infobip-verify-response.json'); if(!a.pinId||!b.verified_success||!b.attempts_exhausted||!b.expired||!b.wrong_pin) throw new Error('fixture missing keys'); console.log('OK');"</automated>
  </verify>
  <requirements>SMS-02, SMS-04</requirements>
  <autonomous>true</autonomous>
  <commit>test(10-01): add Infobip response fixtures for Wave 0 scaffolding</commit>
  <done>두 JSON fixture 파일 존재, 모든 expected key 포함, JSON parse 성공</done>
</task>

<task type="auto" tdd="true">
  <id>10-01-T2</id>
  <name>Task 2: SmsService + InfobipClient + phone.util 백엔드 단위 테스트 스캐폴딩 3종</name>
  <files>
    apps/api/src/modules/sms/sms.service.spec.ts,
    apps/api/src/modules/sms/infobip-client.spec.ts,
    apps/api/src/modules/sms/phone.util.spec.ts
  </files>
  <description>Twilio mock 완전 제거하고 Infobip fetch mock + Valkey mock 기반으로 SmsService spec 재작성. InfobipClient 단위 테스트 신규 작성 (fetch global mock). phone.util 단위 테스트 신규 작성. 이 3파일이 후속 plan의 `<automated>` 명령어 소스.</description>
  <read_first>
    - apps/api/src/modules/sms/sms.service.spec.ts (기존 Twilio mock 구조 — 전면 교체)
    - apps/api/src/modules/sms/sms.service.ts (기존 구현, 시그니처 참조)
    - apps/api/src/modules/booking/providers/redis.provider.ts (InMemoryRedis 시그니처)
    - .planning/phases/10-sms/10-RESEARCH.md §"Code Examples" (SmsService main flow + phone.util + InfobipClient)
    - .planning/phases/10-sms/10-RESEARCH.md §"Common Pitfalls" 1~6
    - .planning/phases/10-sms/10-CONTEXT.md D-03, D-11, D-12, D-14, D-15
    - apps/api/src/modules/sms/__fixtures__/infobip-*-response.json (T1에서 생성)
  </read_first>
  <action>
    **A. `apps/api/src/modules/sms/phone.util.spec.ts`** (신규)

    `describe('parseE164', ...)` + `describe('isChinaMainland', ...)` 두 블록. 테스트 케이스:
    - `parseE164('010-1234-5678')` returns `'+821012345678'`
    - `parseE164('01012345678')` returns `'+821012345678'`
    - `parseE164('+821012345678')` returns `'+821012345678'`
    - `parseE164('+66812345678')` returns `'+66812345678'` (태국)
    - `parseE164('+8613912345678')` returns `'+8613912345678'` (중국 — 통과, 차단은 isChinaMainland 책임)
    - `parseE164('invalid')` throws Error with message containing `'올바른 휴대폰 번호'`
    - `isChinaMainland('+8613912345678')` returns `true`
    - `isChinaMainland('+821012345678')` returns `false`
    - `isChinaMainland('+66812345678')` returns `false`
    - `isChinaMainland('+85212345678')` returns `false` (홍콩 — CN 아님, 차단 대상 외)

    `import { parseE164, isChinaMainland } from './phone.util.js'` — 파일은 Plan 03이 생성. 따라서 이 spec은 RED 상태로 작성됨.

    **B. `apps/api/src/modules/sms/infobip-client.spec.ts`** (신규)

    `global.fetch` vi.fn() mock. 케이스:
    - `sendPin('+821012345678')` 호출 시 fetch는 `POST {baseUrl}/2fa/2/pin`으로, header `Authorization: App test-key`, body JSON에 `applicationId`, `messageId`, `from: 'Grapit'`, `to: '821012345678'` (leading + 제거) 포함
    - `sendPin` 응답 200 + fixture `infobip-send-response.json` 반환 시 `pinId === '9C815F8AF3328'`
    - `sendPin` 응답 400 시 `InfobipApiError` throw with `status === 400`
    - `verifyPin('pinId-with-=+', '123456')` 호출 시 URL path에 `encodeURIComponent('pinId-with-=+')` 포함(Pitfall 6)
    - `verifyPin` 성공 응답 fixture `verified_success` 반환 시 `verified: true, attemptsRemaining: 4`
    - `verifyPin` 실패 응답 `attempts_exhausted` 반환 시 `verified: false, pinError: 'NO_MORE_PIN_ATTEMPTS'`
    - fetch timeout (`AbortSignal.timeout`) 시 error throw

    `import { InfobipClient, InfobipApiError } from './infobip-client.js'` — 파일은 Plan 04가 생성. RED.

    **C. `apps/api/src/modules/sms/sms.service.spec.ts`** (재작성 — 기존 전면 교체)

    기존 `vi.mock('twilio', ...)` 블록 완전 삭제. 신규 구조:

    ```typescript
    vi.mock('./infobip-client.js', () => ({
      InfobipClient: vi.fn().mockImplementation(() => ({
        sendPin: mockSendPin,
        verifyPin: mockVerifyPin,
      })),
      InfobipApiError: class InfobipApiError extends Error {
        constructor(public status: number, public body: string) { super(`${status}: ${body}`); }
      },
    }));
    ```

    `describe` 블록:
    1. **"Production hard-fail"** (D-14, D-16)
       - `NODE_ENV=production` + INFOBIP_API_KEY 미설정 → `new SmsService(...)` throws Error matching `/INFOBIP_API_KEY.*required in production/`
       - `NODE_ENV=production` + INFOBIP_BASE_URL 미설정 → throw matching `/INFOBIP_BASE_URL/`
       - `NODE_ENV=production` + INFOBIP_API_KEY=`'   '` (whitespace only) → throw (trim 검증)
       - `NODE_ENV=production` + 4개 env 모두 정상 → 생성자 no-throw

    2. **"Dev mock mode"** (D-15, D-24)
       - `NODE_ENV=development` + INFOBIP_* 전부 미설정 → 생성자 no-throw
       - `sendVerificationCode('01012345678')` → `{ success: true, message }` 반환, fetch mock 호출되지 않음
       - `verifyCode('01012345678', '000000')` → `{ verified: true }`
       - `verifyCode('01012345678', '123456')` → `{ verified: false, message: /일치하지 않습니다/ }`
       - `verifyCode('01012345678', '000000')` (test 환경) → `{ verified: true }` (D-24)

    3. **"CN(+86) reject"** (D-03)
       - `sendVerificationCode('+8613912345678')` → `BadRequestException` with message matching `/중국 본토.*지원되지 않습니다/`
       - Infobip client 호출되지 않음
       - Valkey resend key 설정되지 않음

    4. **"Resend cooldown"** (D-11)
       - 첫 `sendVerificationCode` 성공 → `redis.set('sms:resend:+821012345678', '1', 'PX', 30000, 'NX')` 호출
       - 두 번째 호출 시 redis.set이 null 반환 → `BadRequestException` 또는 `{ statusCode: 429 }` throw with message `/잠시 후 다시/`
       - dev mock 모드는 cooldown 로직 skip OR 동일 동작 (choose one — 테스트가 Plan 05 결정을 따라간다)

    4a. **"phone 5/h throttle"** (D-06, Plan 05 T3이 GREEN 전환)
       - mockRedis.set은 'OK' 반환(cooldown pass). mockRedis.incr가 1..5 순차 반환 → 5회 success. 6회째 incr=6 반환 → `BadRequestException({ statusCode: 429 })` throw
       - `redis.incr` 인자가 `'sms:send_count:+821012345678'`
       - 첫 호출 시 `redis.expire('sms:send_count:+821012345678', 3600)` 호출됨
       - 6회째에는 Infobip sendPin **미호출** 확인 (사전 차단)
       - Scaffold는 Plan 01이 작성하고 RED 상태로 둔다. Plan 05 T3이 GREEN 전환.

    4b. **"verify 10/15min phone throttle"** (D-07, Plan 05 T3이 GREEN 전환)
       - 동일 e164로 verifyCode 10회 성공 플로우. 11회째 mockRedis.incr=11 반환 → `BadRequestException({ statusCode: 429 })` throw
       - `redis.incr` 인자가 `'sms:verify_count:+821012345678'`
       - 첫 호출 시 `redis.expire('sms:verify_count:+821012345678', 900)` 호출됨
       - 11회째에는 Infobip verifyPin **미호출** 확인
       - dev mock 경로(000000)는 카운터 bypass → `redis.incr` 호출 0회 케이스 추가



    5. **"Production sendPin success"** (SMS-02)
       - 4 env 정상 + NODE_ENV=production → InfobipClient 생성
       - `sendVerificationCode('01012345678')` → `redis.set('sms:resend:+821012345678', ...)` + `mockSendPin('+821012345678')` + `redis.set('sms:pin:+821012345678', 'pinId-from-fixture', 'PX', 200000)` + `{ success: true }` 반환

    6. **"Verify flow — expired PIN"** (D-12, SMS-04)
       - `redis.get('sms:pin:+821012345678')` returns null → `GoneException` with message `/만료되었습니다/`
       - Infobip verifyPin 호출되지 않음

    7. **"Verify flow — attempts exhausted"** (D-12)
       - `redis.get` returns pinId
       - mockVerifyPin returns `attempts_exhausted` fixture
       - → `GoneException` with `/만료되었습니다/`
       - `redis.del('sms:pin:+821012345678')` 호출됨

    8. **"Verify flow — wrong pin"**
       - `redis.get` returns pinId
       - mockVerifyPin returns `wrong_pin` fixture
       - → `{ verified: false, message: /일치하지 않습니다/ }`
       - `redis.del` 호출되지 않음

    9. **"Verify flow — success"** (SMS-02)
       - `redis.get` returns pinId
       - mockVerifyPin returns `verified_success` fixture
       - → `{ verified: true }`
       - `redis.del('sms:pin:+821012345678')` 호출됨 (single-use, D-14 대응)

    Redis는 `{ set: vi.fn(), get: vi.fn(), del: vi.fn(), pttl: vi.fn() }` mock 객체로 주입.

    `import { SmsService } from './sms.service.js'` (기존 파일은 Plan 05가 재작성 — 현재 구조와 생성자 시그니처 다르므로 RED).
  </action>
  <acceptance_criteria>
    - `apps/api/src/modules/sms/phone.util.spec.ts` 존재하고 `describe('parseE164'`, `describe('isChinaMainland'` 모두 포함
    - `apps/api/src/modules/sms/infobip-client.spec.ts` 존재하고 `describe('InfobipClient'`, `'App '` Authorization 검증 포함
    - `apps/api/src/modules/sms/sms.service.spec.ts` 재작성 완료: 기존 `vi.mock('twilio')` 제거(`grep -v` 확인), 신규 `vi.mock('./infobip-client.js'` 추가
    - spec 파일에 `describe.*Production hard-fail`, `describe.*Dev mock`, `describe.*CN.*reject`, `describe.*Resend cooldown`, `describe.*expired`, `describe.*attempts exhausted` 모두 grep으로 확인
    - `grep -c "000000" apps/api/src/modules/sms/sms.service.spec.ts` ≥ 2 (send 경로와 verify 경로 양쪽 dev mock 케이스 존재)
    - `grep -q "중국 본토" apps/api/src/modules/sms/sms.service.spec.ts`
    - `grep -q "sms:resend:" apps/api/src/modules/sms/sms.service.spec.ts`
    - `grep -q "sms:send_count:" apps/api/src/modules/sms/sms.service.spec.ts` (D-06 phone axis scaffold)
    - `grep -q "sms:verify_count:" apps/api/src/modules/sms/sms.service.spec.ts` (D-07 phone axis scaffold)
    - `grep -q "phone 5/h\|D-06" apps/api/src/modules/sms/sms.service.spec.ts`
    - `grep -q "verify 10/15min\|verify 10/900\|D-07" apps/api/src/modules/sms/sms.service.spec.ts`
    - `grep -q "mockRedis.incr\|mockRedis\.incr" apps/api/src/modules/sms/sms.service.spec.ts`
    - `grep -q "sms:pin:" apps/api/src/modules/sms/sms.service.spec.ts`
    - `! grep -q "vi.mock('twilio'" apps/api/src/modules/sms/sms.service.spec.ts` (Twilio mock 완전 제거)
    - `pnpm --filter @grapit/api test sms -- --run` 실행 시 모든 테스트가 **FAIL** 상태(모듈 not found 또는 assertion 미일치) — RED 의도된 상태
  </acceptance_criteria>
  <verify>
    <automated>grep -q "중국 본토" apps/api/src/modules/sms/sms.service.spec.ts && grep -q "sms:resend:" apps/api/src/modules/sms/sms.service.spec.ts && grep -q "sms:send_count:" apps/api/src/modules/sms/sms.service.spec.ts && grep -q "sms:verify_count:" apps/api/src/modules/sms/sms.service.spec.ts && grep -q "sms:pin:" apps/api/src/modules/sms/sms.service.spec.ts && grep -q "Production hard-fail" apps/api/src/modules/sms/sms.service.spec.ts && grep -q "describe.*parseE164" apps/api/src/modules/sms/phone.util.spec.ts && grep -q "describe.*isChinaMainland" apps/api/src/modules/sms/phone.util.spec.ts && grep -q "App " apps/api/src/modules/sms/infobip-client.spec.ts && ! grep -q "vi.mock('twilio'" apps/api/src/modules/sms/sms.service.spec.ts</automated>
  </verify>
  <requirements>SMS-01, SMS-02, SMS-03, SMS-04</requirements>
  <autonomous>true</autonomous>
  <commit>test(10-01): rewrite sms.service.spec + add infobip-client.spec + phone.util.spec (Wave 0 RED)</commit>
  <done>3개 spec 파일 작성 완료, 모든 describe 블록 grep 확인, Twilio mock 잔재 0건, 테스트 실행 시 RED(Plan 03/04/05가 GREEN 전환)</done>
</task>

<task type="auto" tdd="true">
  <id>10-01-T3</id>
  <name>Task 3: Integration + 프론트 단위 + E2E 테스트 스캐폴딩 3종</name>
  <files>
    apps/api/test/sms-throttle.integration.spec.ts,
    apps/web/components/auth/__tests__/phone-verification.test.tsx,
    apps/web/e2e/signup-sms.spec.ts
  </files>
  <description>SMS throttle integration(testcontainers Valkey) + phone-verification React 단위 테스트 + signup mock 모드 E2E 스캐폴딩. Plan 06, 07, 08이 GREEN 전환 대상.</description>
  <read_first>
    - .planning/phases/10-sms/10-VALIDATION.md §"Wave 0 Requirements"
    - .planning/phases/10-sms/10-RESEARCH.md §"Validation Architecture"
    - .planning/phases/10-sms/10-UI-SPEC.md §"Button Labels", §"에러 메시지 카피", §"State Machine"
    - apps/web/components/auth/phone-verification.tsx (기존 구현)
    - apps/api/src/modules/booking/__tests__ 또는 기존 integration test 샘플 (testcontainers 패턴 참조)
    - apps/web/e2e/ 기존 Playwright spec 샘플(`loginAsTestUser` helper 등)
  </read_first>
  <action>
    **A. `apps/api/test/sms-throttle.integration.spec.ts`** (신규)

    testcontainers로 Valkey 컨테이너(`redis/redis-stack` 또는 `valkey/valkey:8.0`) 띄우고 실제 `@nest-lab/throttler-storage-redis` + ioredis 인스턴스로 NestJS 테스트 모듈 구성. Infobip은 fetch mock(또는 `vi.stubGlobal('fetch', ...)`).

    테스트 케이스 (2-axis 검증 — controller IP axis + service phone axis):
    - `beforeAll`: Valkey 컨테이너 start, `ioredis` 연결
    - `beforeEach`: redis FLUSHALL (세션 카운터 초기화)
    - **"send-code phone 5/h throttle (D-06 phone axis)"** — 동일 phone으로 서로 다른 5개 IP에서 `POST /sms/send-code` 5회 200, 6회째 429. phone axis counter(`sms:send_count:+821012345678`)가 IP 무관하게 동작함을 확인 → Plan 05 Task 3 GREEN 전환 대상
    - **"send-code IP 20/h throttle (D-06 IP axis)"** — 서로 다른 20개 phone으로 동일 IP(X-Forwarded-For fixed)에서 20회 성공, 21회째 429 (Plan 06 + Plan 07 ThrottlerStorageRedisService 기반)
    - **"verify-code phone 10/15min throttle (D-07 phone axis)"** — 동일 phone으로 서로 다른 IP에서 10회 verify 호출 성공, 11회째 429. phone axis counter(`sms:verify_count:+821012345678`) 검증 → Plan 05 Task 3 GREEN 전환 대상
    - **"verify-code IP 10/15min throttle (D-07 IP axis)"** — 동일 IP/서로 다른 phone으로 10회 verify, 11회째 429 (Plan 06 IP axis)
    - **"throttle storage persists across NestJS instance restart"** — module.close() → 새 module.create() → IP counter + phone counter 모두 유지 (Valkey 공유 저장소 검증)

    파일 헤더 `@vitest-environment node` 주석. `pnpm --filter @grapit/api test:integration` 으로 실행됨.

    **B. `apps/web/components/auth/__tests__/phone-verification.test.tsx`** (신규)

    @testing-library/react + vitest. `apiClient.post` mock.

    테스트 케이스:
    - **"initial state"** — 버튼 라벨 `인증번호 발송`, variant default, phone ≥10자 되면 enabled
    - **"sending state"** — 버튼 클릭 후 `Loader2` + `발송 중...` 표시 + disabled
    - **"cooldown state"** — 발송 성공 직후 30초 카운트다운. 버튼 라벨 `재발송 (Ns)` 형태(정규식 `/재발송 \(\d+s\)/`) + variant outline + disabled. vitest fake timers로 `vi.advanceTimersByTime(1000)` 반복하며 29→28→...→1→0 전환 확인
    - **"resend-ready state"** — 쿨다운 0초 후 버튼 라벨 `재발송` (괄호 없음) + enabled + variant outline
    - **"만료 타이머 독립성"** — 3분 만료 타이머와 30초 쿨다운 타이머가 동시에 카운트 (동시에 `02:59` 와 `재발송 (28s)` 렌더링됨)
    - **"에러 카피 400 (잘못된 코드)"** — `apiClient.post` reject with status 400 → `"인증번호가 일치하지 않습니다"` 표시
    - **"에러 카피 410/422 (만료)"** — reject with status 410 → `"인증번호가 만료되었습니다. 재발송해주세요"`
    - **"에러 카피 429 (쿨다운)"** — reject with status 429 → `"잠시 후 다시 시도해주세요"`
    - **"에러 카피 400 중국 본토"** — reject with status 400 body `{ message: '현재 중국 본토 SMS 인증은 지원되지 않습니다. 다른 국가 번호로 가입해 주세요' }` → 해당 문구 그대로 표시
    - **"space-y-4 적용"** — 루트 div className에 `space-y-4` 포함 (UI-SPEC §"Spacing Scale")
    - **"자동 완료 accessibility"** — 코드 입력 `<input>` 속성에 `autoComplete="one-time-code"`, `inputMode="numeric"`, `maxLength={6}`

    `vi.useFakeTimers()` 적용. `vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn() } }))`.

    **C. `apps/web/e2e/signup-sms.spec.ts`** (신규)

    Playwright. 회원가입 플로우 완주 시나리오:
    - step1 (email/password) → step2 (이름/약관) → step3 (phone + SMS 인증) → 성공
    - step3에서 `010-1234-5678` 입력 → `인증번호 발송` 클릭 → dev mock 모드이므로 `000000` 입력 → `확인` → 성공
    - 가입 완료 후 dashboard 리다이렉트 확인

    `test.describe.configure({ mode: 'serial' })` 및 `test.setTimeout(60000)`. CI 환경 `INFOBIP_API_KEY` 미주입으로 자동 mock 모드 진입(D-24). unique email 생성(`test-sms-${Date.now()}@grapit.test`).

    E2E는 Plan 08 UI 완료 후 green 예상. 파일은 RED 상태로 스캐폴딩(설정 단계 미완성 상태).
  </action>
  <acceptance_criteria>
    - `apps/api/test/sms-throttle.integration.spec.ts` 존재, `grep -q "testcontainers\\|valkey\\|GenericContainer\\|StartedTestContainer" apps/api/test/sms-throttle.integration.spec.ts`
    - integration spec에 `phone 5/h`, `IP 20/h`, `phone 10/15min`, `IP 10/15min` 4개 케이스 grep 확인 (`grep -c "throttle" apps/api/test/sms-throttle.integration.spec.ts` ≥ 4)
    - `grep -q "sms:send_count:\|sms:verify_count:" apps/api/test/sms-throttle.integration.spec.ts` (phone axis 키 검증)
    - `apps/web/components/auth/__tests__/phone-verification.test.tsx` 존재
    - `grep -q "재발송 (.*s)" apps/web/components/auth/__tests__/phone-verification.test.tsx`
    - `grep -q "잠시 후 다시 시도해주세요" apps/web/components/auth/__tests__/phone-verification.test.tsx`
    - `grep -q "인증번호가 만료되었습니다" apps/web/components/auth/__tests__/phone-verification.test.tsx`
    - `grep -q "중국 본토" apps/web/components/auth/__tests__/phone-verification.test.tsx`
    - `grep -q "space-y-4" apps/web/components/auth/__tests__/phone-verification.test.tsx`
    - `grep -q "one-time-code" apps/web/components/auth/__tests__/phone-verification.test.tsx`
    - `apps/web/e2e/signup-sms.spec.ts` 존재, `grep -q "000000" apps/web/e2e/signup-sms.spec.ts`
    - `pnpm --filter @grapit/web test -- phone-verification --run` 실행 가능 (통과 여부는 RED OK)
  </acceptance_criteria>
  <verify>
    <automated>grep -q "testcontainers\|GenericContainer\|valkey" apps/api/test/sms-throttle.integration.spec.ts && grep -q "재발송 (.*s)" apps/web/components/auth/__tests__/phone-verification.test.tsx && grep -q "잠시 후 다시 시도해주세요" apps/web/components/auth/__tests__/phone-verification.test.tsx && grep -q "중국 본토" apps/web/components/auth/__tests__/phone-verification.test.tsx && grep -q "space-y-4" apps/web/components/auth/__tests__/phone-verification.test.tsx && grep -q "000000" apps/web/e2e/signup-sms.spec.ts</automated>
  </verify>
  <requirements>SMS-01, SMS-02, SMS-03, SMS-04</requirements>
  <autonomous>true</autonomous>
  <commit>test(10-01): add sms-throttle integration + phone-verification component + signup-sms e2e specs (Wave 0 RED)</commit>
  <done>3개 추가 테스트 파일 존재, UI-SPEC 카피·쿨다운 포맷·integration 3케이스 grep 통과, Plan 06/07/08이 GREEN 전환 대상</done>
</task>

<task type="auto">
  <id>10-01-T4</id>
  <name>Task 4: VALIDATION.md Per-Task Verification Map 작성</name>
  <files>.planning/phases/10-sms/10-VALIDATION.md</files>
  <description>10-VALIDATION.md §"Per-Task Verification Map"을 후속 plan의 task ID로 채우고 `nyquist_compliant: true` 플래그 세팅. 본 Wave 0 완료로 후속 waves의 Nyquist 준수 근거 확보.</description>
  <read_first>
    - .planning/phases/10-sms/10-VALIDATION.md (기존 스켈레톤)
    - 본 plan의 모든 task (10-01-T1~T4)
    - 10-02 ~ 10-09 plan들의 task ID (작성 완료 후 이 task가 마지막으로 수행)
  </read_first>
  <action>
    10-VALIDATION.md의 `## Per-Task Verification Map` 표를 모든 plan(10-01 ~ 10-09)의 task ID + requirement + threat ref + automated command으로 채운다. 예시 row:

    ```
    | 10-01-T1 | 10-01 | 0 | SMS-02,04 | T-10-01 | fixture 저장 | fixture | node -e "require(...)" | ❌→✅ | ✅ green |
    | 10-02-T1 | 10-02 | 0 | SMS-02 | T-10-06 | twilio 제거 | deps | grep -q '"twilio"' apps/api/package.json; test $? -ne 0 | ✅ | ⬜ |
    | 10-05-T1 | 10-05 | 2 | SMS-02,03,04 | T-10-01,02,05 | SmsService 재작성 | unit | pnpm --filter @grapit/api test sms -- --run | ✅ | ⬜ |
    | 10-07-T1 | 10-07 | 4 | SMS-01 | T-10-02 | ThrottlerModule Valkey | integration | pnpm --filter @grapit/api test:integration -- sms-throttle | ✅ | ⬜ |
    | 10-08-T1 | 10-08 | 5 | SMS-01,04 | T-10-02,04 | 쿨다운 UI | component | pnpm --filter @grapit/web test phone-verification --run | ✅ | ⬜ |
    ```

    본 task는 본 plan의 **최종 task**로 배치 — T1~T3가 먼저 파일을 만들고 T4에서 자동 command가 실제로 실행 가능함을 기록.

    `## Wave 0 Requirements` 체크박스 전부 `[x]`로 업데이트.

    frontmatter:
    ```yaml
    ---
    phase: 10
    slug: sms
    status: ready
    nyquist_compliant: true
    wave_0_complete: true
    created: 2026-04-16
    ---
    ```

    `**Approval:** pending` → `**Approval:** ready (Wave 0 scaffolding committed)`.
  </action>
  <acceptance_criteria>
    - `grep -q "nyquist_compliant: true" .planning/phases/10-sms/10-VALIDATION.md`
    - `grep -q "wave_0_complete: true" .planning/phases/10-sms/10-VALIDATION.md`
    - `grep -c "10-0[1-9]-T" .planning/phases/10-sms/10-VALIDATION.md` ≥ 12 (T4 포함 최소 12 task)
    - Wave 0 Requirements 체크박스 `- [x]` 7건 grep (`grep -c "- \[x\]" .planning/phases/10-sms/10-VALIDATION.md` ≥ 7)
    - `grep -q "pnpm --filter @grapit/api test sms" .planning/phases/10-sms/10-VALIDATION.md`
    - `grep -q "pnpm --filter @grapit/web test phone-verification" .planning/phases/10-sms/10-VALIDATION.md`
  </acceptance_criteria>
  <verify>
    <automated>grep -q "nyquist_compliant: true" .planning/phases/10-sms/10-VALIDATION.md && grep -q "wave_0_complete: true" .planning/phases/10-sms/10-VALIDATION.md && [ $(grep -c "10-0[1-9]-T" .planning/phases/10-sms/10-VALIDATION.md) -ge 12 ]</automated>
  </verify>
  <requirements>SMS-01, SMS-02, SMS-03, SMS-04</requirements>
  <autonomous>true</autonomous>
  <commit>docs(10-01): populate VALIDATION per-task map, set nyquist_compliant</commit>
  <done>VALIDATION.md frontmatter nyquist_compliant=true, 모든 task row 채워짐, Wave 0 체크박스 전부 x</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 테스트 fixture → production | fixture JSON이 실제 Infobip 응답과 다르면 후속 코드가 잘못된 매핑으로 동작 |
| Wave 0 RED 테스트 → Wave 1+ GREEN 전환 | RED 테스트가 느슨하면 후속 GREEN이 버그를 가림 |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-10-01 | Tampering | fixture JSON | low | accept | Wave 0 fixture는 RESEARCH A1/A2 기반 추정치. Plan 05 완료 후 staging 1회 호출로 zod schema lock 수행(VALIDATION.md Manual-Only Verifications 참조) |
| T-10-02 | Information Disclosure | `sms.service.spec.ts` mock 데이터 | low | accept | fixture에 실 API key/phone 금지. `test-key`, `01012345678`(가짜) 사용 |
| T-10-03 | Repudiation | Wave 0 테스트 느슨함 | medium | mitigate | 각 describe 블록에 CONTEXT.md D-XX 번호 주석으로 추적, acceptance_criteria grep으로 누락 방지 |

Higher severity 위협(SMS pumping, brute-force, credential leak)은 후속 plan에서 직접 완화 (Plan 05, 06, 07).
</threat_model>

<verification>
- `pnpm --filter @grapit/api typecheck` — 신규 spec 파일들의 import 에러는 RED 의도(Plan 03/04/05 전까지). 단 fixture JSON + VALIDATION.md만의 변경은 typecheck에 영향 없음
- `grep` 기반 acceptance criteria 전부 통과
- `pnpm --filter @grapit/api test sms -- --run` 실행 가능(FAIL 상태 — Plan 03/04/05가 GREEN 전환)
</verification>

<success_criteria>
- 7개 테스트 파일 생성/재작성 완료
- 2개 Infobip fixture JSON 저장
- VALIDATION.md Per-Task Map 채워짐, nyquist_compliant=true
- Twilio mock 잔재 0건(sms.service.spec.ts에서 완전 제거)
- 후속 9 waves의 자동 검증 명령어 모두 "파일 존재" 단계를 통과
</success_criteria>

<output>
After completion, create `.planning/phases/10-sms/10-01-SUMMARY.md` 요약:
- 작성된 테스트 파일 7건 + fixture 2건
- 각 spec의 주요 describe 블록 개수
- Plan 03/04/05/06/07/08이 GREEN 전환할 테스트 맵
- Known RED items(import 에러 포함)
</output>
