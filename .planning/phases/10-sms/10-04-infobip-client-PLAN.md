---
phase: 10
plan: 04
type: execute
wave: 1
depends_on: [10-01, 10-02]
files_modified:
  - apps/api/src/modules/sms/infobip-client.ts
autonomous: true
requirements: [SMS-02]
must_haves:
  truths:
    - "InfobipClient.sendPin 호출 시 POST {baseUrl}/2fa/2/pin 엔드포인트 + Authorization: App {apiKey} header 사용"
    - "InfobipClient.verifyPin 호출 시 POST {baseUrl}/2fa/2/pin/{encoded_pinId}/verify 호출, pinId URL encoding 적용"
    - "Infobip 응답 4xx/5xx 시 InfobipApiError(status, body) throw"
    - "5초 timeout(AbortSignal.timeout(5000)) 적용"
    - "infobip-client.spec.ts 전부 green"
  artifacts:
    - path: "apps/api/src/modules/sms/infobip-client.ts"
      provides: "InfobipClient class + InfobipSendPinResponse/InfobipVerifyPinResponse types + InfobipApiError"
      exports: ["InfobipClient", "InfobipApiError", "InfobipSendPinResponse", "InfobipVerifyPinResponse"]
      min_lines: 60
  key_links:
    - from: "infobip-client.ts"
      to: "Infobip 2FA API"
      via: "global fetch + AbortSignal.timeout(5000)"
      pattern: "/2fa/2/pin"
    - from: "Plan 05 sms.service.ts"
      to: "infobip-client.ts"
      via: "new InfobipClient(baseUrl, apiKey, appId, msgId)"
      pattern: "new InfobipClient"
---

<objective>
Infobip 2FA PIN API native fetch wrapper를 작성한다. RESEARCH §"Pattern 3: Infobip fetch wrapper (no SDK)"의 구현을 따르며, Plan 01의 `infobip-client.spec.ts`를 RED→GREEN으로 전환. @infobip-api/sdk 미사용(31개월 stale) — axios 트랜지티브 의존 0 유지.

Purpose: Plan 05 SmsService가 이 client를 constructor에서 생성(hard-fail 통과 후)하고 send/verify를 위임한다. 응답 shape는 RESEARCH Assumptions A1/A2 기반 — Plan 02의 fixture JSON이 mock 응답 소스.

Output: `apps/api/src/modules/sms/infobip-client.ts` + infobip-client.spec.ts GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/10-sms/10-RESEARCH.md
@apps/api/src/modules/sms/infobip-client.spec.ts
@apps/api/src/modules/sms/__fixtures__/infobip-send-response.json
@apps/api/src/modules/sms/__fixtures__/infobip-verify-response.json
</context>

<tasks>

<task type="auto" tdd="true">
  <id>10-04-T1</id>
  <name>Task 1: infobip-client.ts — fetch wrapper + 타입 + 에러 클래스</name>
  <files>apps/api/src/modules/sms/infobip-client.ts</files>
  <behavior>
    - new InfobipClient('https://x.api.infobip.com', 'key', 'app', 'msg') 생성
    - sendPin('+821012345678') → POST https://x.api.infobip.com/2fa/2/pin, header Authorization: "App key", body includes applicationId: 'app', messageId: 'msg', from: 'Grapit', to: '821012345678' (leading + 제거)
    - sendPin 200 응답 시 json 반환(InfobipSendPinResponse — pinId 포함)
    - sendPin 400/500 응답 시 InfobipApiError(status, body) throw
    - verifyPin('pinId/=+special', '123456') → URL path에 encodeURIComponent('pinId/=+special') 포함
    - verifyPin body JSON: { pin: '123456' }
    - fetch에 AbortSignal.timeout(5000) 전달
    - 모든 요청: Content-Type: application/json, Accept: application/json
  </behavior>
  <description>RESEARCH Code Examples §"Pattern 3"의 InfobipClient 블록을 그대로 구현. 80LOC 이내 목표. axios 금지(Node 22 native fetch).</description>
  <read_first>
    - apps/api/src/modules/sms/infobip-client.spec.ts (Plan 01 RED 테스트 — behavior contract)
    - .planning/phases/10-sms/10-RESEARCH.md §"Pattern 3: Infobip fetch wrapper"
    - .planning/phases/10-sms/10-RESEARCH.md §"Common Pitfalls > Pitfall 6" (PIN ID URL encoding)
    - .planning/phases/10-sms/10-RESEARCH.md §"Anti-Patterns" (응답 shape 불변 관련)
    - apps/api/src/modules/sms/__fixtures__/*.json (응답 shape 소스)
  </read_first>
  <action>
    `apps/api/src/modules/sms/infobip-client.ts` 생성. RESEARCH Code Examples §"Pattern 3" 구조 그대로:

    ```typescript
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
      pinError?:
        | 'NO_ERROR'
        | 'WRONG_PIN'
        | 'PIN_EXPIRED'
        | 'NO_MORE_PIN_ATTEMPTS'
        | string;
    }

    export class InfobipApiError extends Error {
      constructor(
        public readonly status: number,
        public readonly body: string,
      ) {
        super(`Infobip API ${status}: ${body}`);
        this.name = 'InfobipApiError';
      }
    }

    export class InfobipClient {
      constructor(
        private readonly baseUrl: string,
        private readonly apiKey: string,
        private readonly applicationId: string,
        private readonly messageId: string,
      ) {}

      async sendPin(toE164: string): Promise<InfobipSendPinResponse> {
        const res = await fetch(`${this.baseUrl}/2fa/2/pin`, {
          method: 'POST',
          headers: {
            Authorization: `App ${this.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            applicationId: this.applicationId,
            messageId: this.messageId,
            from: 'Grapit',
            to: toE164.replace(/^\+/, ''),
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new InfobipApiError(res.status, body);
        }
        return (await res.json()) as InfobipSendPinResponse;
      }

      async verifyPin(
        pinId: string,
        pin: string,
      ): Promise<InfobipVerifyPinResponse> {
        const res = await fetch(
          `${this.baseUrl}/2fa/2/pin/${encodeURIComponent(pinId)}/verify`,
          {
            method: 'POST',
            headers: {
              Authorization: `App ${this.apiKey}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ pin }),
            signal: AbortSignal.timeout(5000),
          },
        );
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new InfobipApiError(res.status, body);
        }
        return (await res.json()) as InfobipVerifyPinResponse;
      }
    }
    ```

    구현 시 주의:
    - TypeScript strict: `any` 금지, 응답 cast는 `as InfobipSendPinResponse` 명시
    - ES module: 서드파티 import 없음(fetch/AbortSignal은 Node 22 global)
    - `encodeURIComponent(pinId)` 누락 금지 (Pitfall 6)
    - `toE164.replace(/^\+/, '')` — Infobip은 leading + 없는 E.164(`821012345678`) 기대
    - `res.text().catch(() => '')` — body 파싱 실패 시 빈 문자열로 fallback
    - 5초 timeout은 Cloud Run 5s budget (RESEARCH Assumption A7)

    작성 후 `pnpm --filter @grapit/api test infobip-client -- --run` GREEN 확인.
  </action>
  <acceptance_criteria>
    - `apps/api/src/modules/sms/infobip-client.ts` 파일 존재
    - `grep -q "export class InfobipClient" apps/api/src/modules/sms/infobip-client.ts`
    - `grep -q "export class InfobipApiError" apps/api/src/modules/sms/infobip-client.ts`
    - `grep -q "export interface InfobipSendPinResponse" apps/api/src/modules/sms/infobip-client.ts`
    - `grep -q "export interface InfobipVerifyPinResponse" apps/api/src/modules/sms/infobip-client.ts`
    - `grep -q 'App \\${' apps/api/src/modules/sms/infobip-client.ts` (Authorization 형식)
    - `grep -q "/2fa/2/pin" apps/api/src/modules/sms/infobip-client.ts`
    - `grep -q "encodeURIComponent(pinId)" apps/api/src/modules/sms/infobip-client.ts` (Pitfall 6)
    - `grep -q "AbortSignal.timeout(5000)" apps/api/src/modules/sms/infobip-client.ts`
    - `grep -q "replace(/\\^\\\\+/" apps/api/src/modules/sms/infobip-client.ts` (leading + 제거)
    - `! grep -q "import axios" apps/api/src/modules/sms/infobip-client.ts` (axios 금지)
    - `! grep -q "@infobip-api/sdk" apps/api/src/modules/sms/infobip-client.ts` (SDK 금지)
    - `pnpm --filter @grapit/api test infobip-client -- --run` 전부 green
    - `pnpm --filter @grapit/api lint -- apps/api/src/modules/sms/infobip-client.ts` exits 0 (lint warning 0)
  </acceptance_criteria>
  <verify>
    <automated>pnpm --filter @grapit/api test infobip-client -- --run 2>&1 | tail -15 && pnpm --filter @grapit/api lint -- apps/api/src/modules/sms/infobip-client.ts 2>&1 | tail -5</automated>
  </verify>
  <requirements>SMS-02</requirements>
  <autonomous>true</autonomous>
  <commit>feat(10-04): add InfobipClient fetch wrapper for 2FA PIN API</commit>
  <done>infobip-client.ts 작성, infobip-client.spec.ts GREEN, axios 사용 0, encodeURIComponent + 5초 timeout 준수</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Grapit Cloud Run → Infobip API | HTTPS 외부 호출, API key 서버 측에서만 사용 |
| Infobip 응답 → Grapit 내부 | 응답 JSON을 cast하지만 zod schema lock은 Wave 0 staging smoke에서 (Assumption A1) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-10-13 | Information Disclosure | `Authorization: App ${apiKey}` header | high | mitigate | apiKey는 constructor에만 전달되고 외부 노출 없음. 로깅 없음. Plan 05에서 Sentry scope tag에도 tag 값에 key 미포함(http_status만) |
| T-10-14 | Tampering | Infobip 응답 조작 | low | accept | HTTPS + Infobip 신뢰 routing. 응답 JSON 필드 타입 불일치 시 후속 Plan 05 분기에서 `attemptsRemaining === 0` 등으로 check |
| T-10-15 | Denial of Service | slow Infobip response | medium | mitigate | AbortSignal.timeout(5000) — 5초 후 abort. Cloud Run 요청 timeout budget(60s)과 비교 충분한 margin |
| T-10-16 | Information Disclosure | Error body 노출 | medium | mitigate | InfobipApiError는 status + body를 포함 — Plan 05에서 Sentry에만 전달, 사용자에게는 일반 메시지 "일시적인 오류가 발생했습니다" 반환 |
| T-10-17 | Spoofing | pinId URL injection | medium | mitigate | encodeURIComponent(pinId)로 path injection 방지(Pitfall 6). pinId는 Infobip 발급 토큰이므로 기본 안전하나 defense-in-depth |

High severity(T-10-13 credential leak) 는 코드 레벨에서 header에만 사용 + 로깅 0 으로 완화. DEPLOY-CHECKLIST 운영 가이드에서 GCP Secret Manager 사용 강제.
</threat_model>

<verification>
- `pnpm --filter @grapit/api test infobip-client -- --run` green
- `pnpm --filter @grapit/api typecheck` — phone.util.ts + infobip-client.ts 관련 에러 0. sms.service.ts의 twilio import는 아직 RED
- `pnpm --filter @grapit/api lint` 본 plan이 수정한 파일 기준 warning 0 (apps/api/src/modules/sms/infobip-client.ts)
</verification>

<success_criteria>
- InfobipClient class + 2 response interface + InfobipApiError export
- infobip-client.spec.ts GREEN(fetch mock으로 URL/header/body 검증 + 4xx 에러 + pinId encoding)
- axios / @infobip-api/sdk 0건
</success_criteria>

<output>
Create `.planning/phases/10-sms/10-04-SUMMARY.md`: exported 심볼, 사용 패턴(Plan 05 예시), axios 회피 근거.
</output>
