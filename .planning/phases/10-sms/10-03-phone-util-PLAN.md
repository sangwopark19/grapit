---
phase: 10
plan: 03
type: execute
wave: 1
depends_on: [10-01, 10-02]
files_modified:
  - apps/api/src/modules/sms/phone.util.ts
autonomous: true
requirements: [SMS-02]
must_haves:
  truths:
    - "parseE164()가 한국 로컬 포맷과 E.164 국제 포맷을 모두 +82 E.164로 정규화"
    - "isChinaMainland()가 +86 번호만 true 반환(+852 홍콩, +853 마카오, +886 대만 false)"
    - "잘못된 번호는 '올바른 휴대폰 번호를 입력해주세요' 에러 throw"
    - "phone.util.spec.ts 모든 테스트 green"
  artifacts:
    - path: "apps/api/src/modules/sms/phone.util.ts"
      provides: "parseE164, isChinaMainland — libphonenumber-js/min 기반"
      exports: ["parseE164", "isChinaMainland"]
      min_lines: 25
  key_links:
    - from: "apps/api/src/modules/sms/phone.util.ts"
      to: "libphonenumber-js/min"
      via: "import { parsePhoneNumberWithError, ParseError } from 'libphonenumber-js/min'"
      pattern: "libphonenumber-js/min"
    - from: "Plan 05 sms.service.ts"
      to: "phone.util.ts"
      via: "parseE164 호출, isChinaMainland 호출"
      pattern: "parseE164|isChinaMainland"
---

<objective>
백엔드 전화번호 정규화 + 중국 본토 감지 유틸을 작성한다. RESEARCH §"Code Examples > Phone util"의 구현을 그대로 따르되, Plan 01이 작성한 `phone.util.spec.ts`를 RED→GREEN으로 전환하는 것이 완료 기준.

Purpose: Plan 05의 SmsService가 모든 메서드 첫 줄에 `parseE164()`를 호출해서 send-code와 verify-code가 동일 키(`sms:pin:{e164}`, `sms:resend:{e164}`)를 사용하도록 보장 (RESEARCH Pitfall 3 대응). 중국 본토 차단(D-03)은 prefix 매칭 대신 libphonenumber-js의 country 속성으로 정확히 판정.

Output: `apps/api/src/modules/sms/phone.util.ts` + phone.util.spec.ts GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/10-sms/10-CONTEXT.md
@.planning/phases/10-sms/10-RESEARCH.md
@apps/api/src/modules/sms/phone.util.spec.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <id>10-03-T1</id>
  <name>Task 1: phone.util.ts 작성 (parseE164 + isChinaMainland)</name>
  <files>apps/api/src/modules/sms/phone.util.ts</files>
  <behavior>
    - parseE164('010-1234-5678') === '+821012345678'
    - parseE164('01012345678') === '+821012345678'
    - parseE164('+821012345678') === '+821012345678'
    - parseE164('+66812345678') === '+66812345678' (태국 E.164 passthrough)
    - parseE164('+8613912345678') === '+8613912345678' (CN passthrough, 차단은 isChinaMainland 책임)
    - parseE164('invalid') throws Error with '올바른 휴대폰 번호를 입력해주세요'
    - isChinaMainland('+8613912345678') === true
    - isChinaMainland('+821012345678') === false
    - isChinaMainland('+85212345678') === false (홍콩 non-mainland)
    - isChinaMainland('+86') === false (잘못된 번호 → catch → false)
  </behavior>
  <description>RESEARCH Code Examples §"Phone util (libphonenumber-js)" 패턴 그대로 구현. libphonenumber-js/min(80KB metadata)을 import해서 번들/cold-start 최소화.</description>
  <read_first>
    - apps/api/src/modules/sms/phone.util.spec.ts (Plan 01에서 작성한 RED 테스트 — 본 파일의 behavior contract)
    - .planning/phases/10-sms/10-RESEARCH.md §"Code Examples > Phone util"
    - .planning/phases/10-sms/10-RESEARCH.md §"Common Pitfalls > Pitfall 3"
    - .planning/phases/10-sms/10-CONTEXT.md D-03 (중국 본토 차단)
  </read_first>
  <action>
    `apps/api/src/modules/sms/phone.util.ts` 생성. 구현은 RESEARCH Code Examples §"Phone util" 블록 그대로:

    ```typescript
    import { parsePhoneNumberWithError, ParseError } from 'libphonenumber-js/min';

    export function parseE164(input: string): string {
      const cleaned = input.replace(/[^+\d]/g, '');
      // Korean local format (010-1234-5678 or 01012345678) → +82
      if (/^01[016789]\d{7,8}$/.test(cleaned)) {
        return `+82${cleaned.slice(1)}`;
      }
      try {
        const parsed = parsePhoneNumberWithError(
          cleaned.startsWith('+') ? cleaned : `+${cleaned}`,
        );
        return parsed.number;  // Returns E.164 like '+821012345678'
      } catch (err) {
        if (err instanceof ParseError) {
          throw new Error('올바른 휴대폰 번호를 입력해주세요');
        }
        throw err;
      }
    }

    export function isChinaMainland(e164: string): boolean {
      try {
        const parsed = parsePhoneNumberWithError(e164);
        return parsed.country === 'CN';
      } catch {
        return false;
      }
    }
    ```

    중요:
    - `libphonenumber-js/min` sub-entry만 사용 (metadata 80KB — cold-start 부담 최소)
    - 한국 로컬 포맷은 early return으로 libphonenumber 호출 우회 (빈번 케이스 fast path)
    - 에러 메시지는 사용자 향 문구 그대로(프론트에서 그대로 노출 가능)
    - TypeScript strict 준수: `any` 금지, `parsed.number`는 `string` 추론됨
    - ES module 규칙: `.js` 확장자 import 없이 라이브러리 경로 그대로 (라이브러리 자체는 NodeNext 해석)

    작성 후 `pnpm --filter @grapit/api test phone.util -- --run` 실행해서 spec GREEN 확인.
  </action>
  <acceptance_criteria>
    - `apps/api/src/modules/sms/phone.util.ts` 파일 존재
    - `grep -q "from 'libphonenumber-js/min'" apps/api/src/modules/sms/phone.util.ts`
    - `grep -q "export function parseE164" apps/api/src/modules/sms/phone.util.ts`
    - `grep -q "export function isChinaMainland" apps/api/src/modules/sms/phone.util.ts`
    - `grep -q "\\+82" apps/api/src/modules/sms/phone.util.ts` (한국 fast path)
    - `grep -q "'CN'" apps/api/src/modules/sms/phone.util.ts`
    - `grep -q "올바른 휴대폰 번호" apps/api/src/modules/sms/phone.util.ts`
    - `pnpm --filter @grapit/api test phone.util -- --run` 전부 통과(GREEN 전환)
    - `pnpm --filter @grapit/api typecheck`에서 phone.util.ts 관련 에러 0건 (sms.service.ts의 twilio import는 여전히 존재 → 전체 typecheck는 여전히 RED)
    - `! grep -q "any" apps/api/src/modules/sms/phone.util.ts` 또는 `grep -c ": any" apps/api/src/modules/sms/phone.util.ts` == 0 (strict 준수)
    - `pnpm --filter @grapit/api lint -- apps/api/src/modules/sms/phone.util.ts` exits 0 (lint warning 0)
  </acceptance_criteria>
  <verify>
    <automated>pnpm --filter @grapit/api test phone.util -- --run 2>&1 | tail -15 && pnpm --filter @grapit/api lint -- apps/api/src/modules/sms/phone.util.ts 2>&1 | tail -5</automated>
  </verify>
  <requirements>SMS-02</requirements>
  <autonomous>true</autonomous>
  <commit>feat(10-03): add phone.util with parseE164 + isChinaMainland (libphonenumber-js/min)</commit>
  <done>phone.util.ts 2 함수 export, phone.util.spec.ts GREEN, libphonenumber-js/min 사용, strict TS 준수</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 클라이언트 phone 입력 → 백엔드 정규화 | 악의적 입력(+86...)을 프론트 차단 없이 백엔드가 차단(D-03) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-10-10 | Spoofing | phone country detection | medium | mitigate | libphonenumber-js `parsed.country === 'CN'`로 prefix 매칭 취약점(Pitfall 중 국가 감지) 회피. `+8612345` 같은 입력도 정확히 판정 |
| T-10-11 | Tampering | parseE164 에러 처리 | low | accept | ParseError catch 후 한국어 메시지 throw — 파싱 실패는 정상 플로우 |
| T-10-12 | Information Disclosure | phone log | low | accept | phone.util 자체는 로깅 없음. Plan 05 SmsService의 logger가 e164를 로깅하지만 내부 관측 용도(Sentry PII scrubbing은 상위 레이어) |

본 plan은 backend-only utility 레이어로 high severity 위협 경로에 직접 노출되지 않음. CN 차단(D-03, high severity branch)는 본 유틸이 담당하되 실제 throw는 Plan 05 SmsService가 수행.
</threat_model>

<verification>
- `pnpm --filter @grapit/api test phone.util -- --run` 전부 green
- `pnpm --filter @grapit/api lint` 본 plan이 수정한 파일 기준 warning 0 (apps/api/src/modules/sms/phone.util.ts)
- `grep -q "libphonenumber-js/min" apps/api/src/modules/sms/phone.util.ts`
</verification>

<success_criteria>
- phone.util.ts 2 export(parseE164, isChinaMainland)
- phone.util.spec.ts GREEN
- RESEARCH Pitfall 3(phone normalization mismatch) 방지 준비 완료
</success_criteria>

<output>
Create `.planning/phases/10-sms/10-03-SUMMARY.md`: 함수 시그니처, libphonenumber-js/min 사용 근거, 테스트 green 증거.
</output>
