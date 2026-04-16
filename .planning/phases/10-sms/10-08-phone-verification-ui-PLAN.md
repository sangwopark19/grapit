---
phase: 10
plan: 08
type: execute
wave: 4
depends_on: [10-05, 10-06]
files_modified:
  - apps/web/components/auth/phone-verification.tsx
  - apps/web/lib/phone.ts
  - packages/shared/src/constants/index.ts
autonomous: true
requirements: [SMS-01, SMS-02, SMS-04]
must_haves:
  truths:
    - "phone-verification.tsx가 30s 재발송 쿨다운 독립 타이머 보유 (만료 180s 타이머와 별도)"
    - "재발송 버튼이 4-상태 렌더링 (initial / sending / cooldown / resend-ready) 정확히 전환"
    - "에러 카피가 HTTP 상태별 분기 (429/410/422/400 CN/400 invalid/5xx)"
    - "버튼 variant가 쿨다운/리센드 상태에서 'outline' (accent 미사용) — UI-SPEC 계약"
    - "space-y-3 → space-y-4 교정, text-sm(만료 타이머) → text-caption 교정"
    - "국제 번호(+로 시작) 입력 시 masking 없이 raw passthrough, 국가 감지 안내 표시"
    - "인증번호 입력에 autoComplete='one-time-code' 추가"
    - "packages/shared에 SMS_RESEND_COOLDOWN_SECONDS=30 상수 추가 (서버 D-11과 동일)"
    - "phone-verification.test.tsx(Wave 0에서 RED로 작성)가 GREEN 전환"
  artifacts:
    - path: "apps/web/components/auth/phone-verification.tsx"
      provides: "4-state 버튼 + 30s 쿨다운 + HTTP 상태 에러 매핑 + 국제 번호 지원"
      contains: "resendCooldown"
    - path: "apps/web/lib/phone.ts"
      provides: "detectPhoneLocale(input) — 국가/로캘 감지 유틸"
      exports: ["detectPhoneLocale"]
    - path: "packages/shared/src/constants/index.ts"
      provides: "SMS_RESEND_COOLDOWN_SECONDS=30 공유 상수 추가"
      contains: "SMS_RESEND_COOLDOWN_SECONDS"
  key_links:
    - from: "phone-verification.tsx"
      to: "apiClient (ApiClientError.statusCode)"
      via: "err.statusCode 분기로 카피 매핑"
      pattern: "statusCode"
    - from: "phone-verification.tsx"
      to: "SMS_RESEND_COOLDOWN_SECONDS"
      via: "@grapit/shared import"
      pattern: "SMS_RESEND_COOLDOWN_SECONDS"
    - from: "phone-verification.tsx"
      to: "apps/web/lib/phone.ts"
      via: "detectPhoneLocale(input) 호출"
      pattern: "detectPhoneLocale"
---

<objective>
`phone-verification.tsx`를 UI-SPEC.md(§"Copywriting Contract", §"Button Labels — 4가지 상태", §"State Machine", §"에러 메시지 카피")에 정의된 계약대로 재작성한다. 변경 범위는 **이 단일 컴포넌트 + 공유 상수 + 유틸 1개**로 한정(CONTEXT D-18~D-20, UI-SPEC §"변경 없음 (호출부)"). 다른 컴포넌트/페이지 재스타일 금지.

Purpose: D-18(30초 쿨다운 + 카운트다운 라벨), D-19(시도 횟수 UI 노출 금지), D-20(HTTP 상태별 에러 카피 분기 3종) 실현. 서버(Plan 05/06)의 429/410/400 응답을 사용자에게 정확한 카피로 표시해 재발송/재시도 의사결정을 돕는다.

Output: phone-verification.tsx 재작성 + lib/phone.ts 신규 + 공유 상수 추가.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/10-sms/10-CONTEXT.md
@.planning/phases/10-sms/10-RESEARCH.md
@.planning/phases/10-sms/10-UI-SPEC.md
@apps/web/components/auth/phone-verification.tsx
@apps/web/lib/api-client.ts
@apps/web/components/auth/__tests__/phone-verification.test.tsx
@packages/shared/src/constants/index.ts

<interfaces>
# 관련 contracts

```typescript
// apps/web/lib/api-client.ts (기존 — 변경 없음)
class ApiClientError extends Error {
  statusCode: number;   // 에러 매핑의 핵심 필드
  message: string;      // 서버 ErrorBody.message 반영 (CN 차단 메시지 포함)
  constructor(message: string, statusCode: number);
}

// packages/shared/src/constants/index.ts
export const SMS_CODE_EXPIRY_SECONDS = 180;          // 기존 — 불변
export const SMS_CODE_LENGTH = 6;                    // 기존 — 불변
export const SMS_RESEND_COOLDOWN_SECONDS = 30;       // 신규 — 서버 D-11과 동일 값

// apps/web/lib/phone.ts (신규)
export interface PhoneLocale {
  isKorean: boolean;
  country: string | null;      // ISO 2자리 (KR, TH, ...) 또는 null
  countryName: string | null;  // 국가명 한국어 — 표시용 (자유롭게 매핑, 예: KR→'한국', TH→'태국')
  e164: string | null;         // 정규화된 E.164 — null이면 감지 실패
}
export function detectPhoneLocale(input: string): PhoneLocale;
```

```xml
<!-- phone-verification.tsx 내부 컴포넌트 계약 (호출부 변경 없음) -->
props:
  phone: string
  onPhoneChange: (phone: string) => void
  onVerified: (code: string) => void
  isVerified: boolean
  error?: string
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <id>10-08-T1</id>
  <name>Task 1: 공유 상수 추가 + detectPhoneLocale 유틸 작성</name>
  <files>
    packages/shared/src/constants/index.ts,
    apps/web/lib/phone.ts
  </files>
  <description>UI-SPEC §"쿨다운 타이머 구현" 권장대로 공유 상수 `SMS_RESEND_COOLDOWN_SECONDS=30`을 packages/shared에 추가해 서버 D-11(30s) 값과 단일 소스로 관리. 국가 감지 유틸은 prefix 매칭(한국) + libphonenumber-js/min(나머지) 조합 — UI-SPEC §"국가 감지 안내" 및 §"Implementation Notes for Planner/Executor" 권장 구현.</description>
  <read_first>
    - packages/shared/src/constants/index.ts (기존 SMS_CODE_EXPIRY_SECONDS 옆에 추가)
    - .planning/phases/10-sms/10-CONTEXT.md D-11
    - .planning/phases/10-sms/10-UI-SPEC.md §"국가 감지 안내", §"Implementation Notes for Planner/Executor > 국가 감지 구현 권장"
    - apps/web/package.json (libphonenumber-js ^1.12.41이 Plan 02에서 추가되었는지 확인)
  </read_first>
  <action>
    **A. packages/shared/src/constants/index.ts**
    기존 상수 정의 섹션에 한 줄 추가 (SMS_CODE_EXPIRY_SECONDS 옆):
    ```typescript
    export const SMS_CODE_EXPIRY_SECONDS = 180;
    export const SMS_CODE_LENGTH = 6;
    export const SMS_RESEND_COOLDOWN_SECONDS = 30;  // D-11: 재발송 쿨다운 (서버 sms:resend:{e164} PX 30000과 동일)
    ```

    기타 상수(AUTH_COOKIE_NAME, PERFORMANCES_PER_PAGE 등)는 변경 금지.

    **B. apps/web/lib/phone.ts (신규)**
    ```typescript
    import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

    export interface PhoneLocale {
      isKorean: boolean;
      country: string | null;
      countryName: string | null;
      e164: string | null;
    }

    const COUNTRY_NAME_KO: Record<string, string> = {
      KR: '한국',
      TH: '태국',
      JP: '일본',
      US: '미국',
      VN: '베트남',
      HK: '홍콩',
      TW: '대만',
      SG: '싱가포르',
      PH: '필리핀',
      ID: '인도네시아',
      MY: '말레이시아',
      CN: '중국',
    };

    export function detectPhoneLocale(input: string): PhoneLocale {
      const cleaned = input.replace(/\s+/g, '');

      // 한국 로컬 포맷 우선 감지 (010 등)
      if (/^01[016789]\d{7,8}$/.test(cleaned.replace(/\D/g, ''))) {
        return {
          isKorean: true,
          country: 'KR',
          countryName: '한국',
          e164: null,   // 백엔드 parseE164가 +82로 변환 — 프론트는 raw 유지
        };
      }

      // E.164 파싱
      const withPlus = cleaned.startsWith('+') ? cleaned : (cleaned.length > 0 ? `+${cleaned}` : cleaned);
      const parsed = parsePhoneNumberFromString(withPlus);
      if (parsed?.isValid()) {
        const country = parsed.country ?? null;
        return {
          isKorean: country === 'KR',
          country,
          countryName: country ? (COUNTRY_NAME_KO[country] ?? null) : null,
          e164: parsed.format('E.164'),
        };
      }

      return { isKorean: false, country: null, countryName: null, e164: null };
    }
    ```

    **주의사항:**
    - `libphonenumber-js/min`(금속 데이터 ~80KB) 사용, full 버전 금지 — UI-SPEC §"Registry Safety > 의존성 추가" 참고
    - 서버 parseE164와 규칙 일치 (한국 로컬 → KR, E.164 → 그대로) — RESEARCH Pitfall 3 대응
    - 국가명 매핑은 12개 기본 + fallback `null` → 컴포넌트에서 "국제 번호로 SMS를 발송합니다" 표시
    - 중국 본토(+86) 감지되어도 **프론트에서 사전 차단 금지** — UI-SPEC §"국가 감지 안내" (발송 시도 후 400으로만 표시)
  </action>
  <acceptance_criteria>
    - `grep -q "SMS_RESEND_COOLDOWN_SECONDS = 30" packages/shared/src/constants/index.ts`
    - `grep -q "SMS_CODE_EXPIRY_SECONDS = 180" packages/shared/src/constants/index.ts` (기존 보존)
    - `test -f apps/web/lib/phone.ts`
    - `grep -q "export function detectPhoneLocale" apps/web/lib/phone.ts`
    - `grep -q "libphonenumber-js/min" apps/web/lib/phone.ts`
    - `grep -q "KR: '한국'" apps/web/lib/phone.ts`
    - `pnpm --filter @grapit/shared typecheck` exits 0 (만약 shared package typecheck script 존재)
    - `pnpm --filter @grapit/web typecheck` exits 0
  </acceptance_criteria>
  <verify>
    <automated>pnpm --filter @grapit/web typecheck</automated>
  </verify>
  <requirements>SMS-01, SMS-02</requirements>
  <autonomous>true</autonomous>
  <commit>feat(10-08): add SMS_RESEND_COOLDOWN_SECONDS shared constant + detectPhoneLocale util</commit>
  <done>공유 상수 + phone.ts 유틸 존재, typecheck green, UI-SPEC 국가명 매핑 12개 기본 + fallback</done>
</task>

<task type="auto" tdd="true">
  <id>10-08-T2</id>
  <name>Task 2: phone-verification.tsx 재작성 — 4-state 버튼 + 30s 쿨다운 + 에러 카피 분기 + 국제 번호 지원</name>
  <files>apps/web/components/auth/phone-verification.tsx</files>
  <behavior>
    - 30초 재발송 쿨다운 독립 타이머(`resendCooldown` state) 추가, 1초 단위 감소, 0 도달 시 버튼 재활성
    - 발송 성공 시 `setTimeLeft(SMS_CODE_EXPIRY_SECONDS)` + `setResendCooldown(SMS_RESEND_COOLDOWN_SECONDS)` 둘 다 시작 (독립 타이머)
    - 버튼 4-state: initial ("인증번호 발송", default variant) / sending (Loader2 + "발송 중...", default, disabled) / cooldown ("재발송 (Ns)", outline, disabled) / resend-ready ("재발송", outline, enabled)
    - 쿨다운 숫자: 정수초 1부터 30까지, 단위 "s" (소문자)
    - 만료 타이머는 기존 `formatTime` 유지, 색 토큰 `text-sm` → `text-caption` 교정 (UI-SPEC §"Timer Display")
    - 루트 div `space-y-3` → `space-y-4` 교정 (8-point 스케일 준수)
    - `handleSendCode` 에러 시 `mapErrorToCopy(err)` 호출해 HTTP 상태별 카피 매핑 (429/410/422/400 CN/400 invalid/5xx 분기)
    - `handleVerifyCode` 동일 에러 매핑 사용
    - 전화번호 입력: 한국 로컬 감지 시 `formatPhoneInput` 마스킹, 국제 번호(`+`로 시작) 감지 시 raw passthrough
    - 국가 감지 안내 표시 (한국 제외, 중국 제외, 나머지 감지된 국가만)
    - 인증번호 input에 `autoComplete="one-time-code"` 추가
    - 전화번호 input에 `autoComplete="tel"` 추가
    - 재발송 버튼에 `aria-label="재발송 대기 중, {N}초 남음"` (쿨다운 상태에서만)
    - verify error `<p>`에 `role="alert" aria-live="assertive"`
    - 국가 안내 `<span>`에 `aria-live="polite"`
    - Button size: send/verify 버튼 모두 `size="lg"` (h-10) — UI-SPEC §"Button size 교정"
    - 시도 횟수 노출 UI 없음 (D-19)
    - 기존 props 인터페이스 불변 (phone, onPhoneChange, onVerified, isVerified, error)
    - 기존 만료 타이머 useEffect 로직 유지, 쿨다운 useEffect는 별도 블록으로 추가
  </behavior>
  <read_first>
    - apps/web/components/auth/phone-verification.tsx (기존 227줄 — 전면 리팩터링 대상)
    - .planning/phases/10-sms/10-UI-SPEC.md §"Copywriting Contract", §"Button Labels — 4가지 상태", §"State Machine — 재발송 버튼", §"에러 메시지 카피", §"Implementation Notes for Planner/Executor"
    - .planning/phases/10-sms/10-CONTEXT.md D-18, D-19, D-20
    - apps/web/lib/api-client.ts (ApiClientError.statusCode 필드 확인)
    - apps/web/components/auth/__tests__/phone-verification.test.tsx (Plan 01 RED 테스트, 본 Task가 GREEN 전환)
    - apps/web/lib/phone.ts (Task 1에서 생성)
    - packages/shared/src/constants/index.ts (Task 1에서 SMS_RESEND_COOLDOWN_SECONDS 추가)
  </read_first>
  <action>
    **전체 구조 (짧은 요약):**
    기존 컴포넌트에 (a) `resendCooldown` state + 관련 useEffect, (b) `mapErrorToCopy` 헬퍼, (c) 4-state 버튼 렌더링 분기, (d) `detectPhoneLocale` 호출로 국가 안내, (e) 토큰/속성 교정을 추가한다. 공개 API(props) 는 불변.

    **1. Imports 추가:**
    ```typescript
    import {
      SMS_CODE_EXPIRY_SECONDS,
      SMS_RESEND_COOLDOWN_SECONDS,
    } from '@grapit/shared';
    import { ApiClientError } from '@/lib/api-client';
    import { detectPhoneLocale } from '@/lib/phone';
    ```

    **2. state 추가:**
    ```typescript
    const [resendCooldown, setResendCooldown] = useState(0);
    const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    ```

    **3. 쿨다운 useEffect** (기존 만료 타이머 useEffect 아래에 추가):
    ```typescript
    useEffect(() => {
      if (resendCooldown <= 0) {
        if (cooldownTimerRef.current) {
          clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
        }
        return;
      }
      cooldownTimerRef.current = setInterval(() => {
        setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
      return () => {
        if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      };
    }, [resendCooldown]);
    ```

    **4. locale 감지 (render-time):**
    ```typescript
    const locale = detectPhoneLocale(phone);
    const showCountryHint =
      !locale.isKorean && locale.country !== null && locale.country !== 'CN';
    ```

    **5. handleSendCode 내부:**
    - try 블록 성공 후:
      ```typescript
      setCodeSent(true);
      setCode('');
      setTimeLeft(SMS_CODE_EXPIRY_SECONDS);
      setResendCooldown(SMS_RESEND_COOLDOWN_SECONDS);
      ```
    - catch 블록: `setVerifyError(mapErrorToCopy(err))` (기존 `err.message`는 무시하지 않되, CN 차단 메시지는 서버가 body.message로 내려주므로 ApiClientError.message에 포함되어 있음 — mapErrorToCopy에서 사용)

    **6. handleVerifyCode 내부:**
    - success: 기존 `onVerified(code)` 호출
    - failure (res.verified === false): `setVerifyError('인증번호가 일치하지 않습니다')`
    - throw (HTTP 4xx/5xx): `setVerifyError(mapErrorToCopy(err))`
    - **추가 중요:** 410/422 응답이면 `setTimeLeft(0)` 강제 설정해 expired state로 진입 (UI-SPEC §"검증 실패 케이스 분기")

    **7. `mapErrorToCopy` 헬퍼** (컴포넌트 내부 또는 파일 하단):
    ```typescript
    function mapErrorToCopy(err: unknown): string {
      if (err instanceof ApiClientError) {
        const status = err.statusCode;
        if (status === 429) return '잠시 후 다시 시도해주세요';
        if (status === 410 || status === 422) return '인증번호가 만료되었습니다. 재발송해주세요';
        if (status === 400) {
          // 중국 본토 차단 메시지는 서버 body.message에서 내려옴
          if (err.message.includes('중국 본토')) return err.message;
          return '인증번호가 일치하지 않습니다';
        }
        if (status >= 500) return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      }
      return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }
    ```

    **8. 버튼 4-state 렌더링 (send 버튼):**
    ```tsx
    <Button
      type="button"
      variant={codeSent ? 'outline' : 'default'}
      size="lg"
      onClick={handleSendCode}
      disabled={
        isVerified
        || isSending
        || (codeSent && resendCooldown > 0)
        || (!codeSent && phone.length < 10 && !locale.country)
      }
      aria-label={
        codeSent && resendCooldown > 0
          ? `재발송 대기 중, ${resendCooldown}초 남음`
          : undefined
      }
      className="shrink-0 whitespace-nowrap"
    >
      {isSending ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> 발송 중...</>
      ) : codeSent && resendCooldown > 0 ? (
        `재발송 (${resendCooldown}s)`
      ) : codeSent ? (
        '재발송'
      ) : (
        '인증번호 발송'
      )}
    </Button>
    ```

    **9. 전화번호 input 포맷 분기:**
    기존 `handlePhoneInput`을 조건부로 변경:
    ```typescript
    function handlePhoneInput(value: string) {
      // 한국 로컬 포맷만 masking, +로 시작하면 raw passthrough
      if (value.startsWith('+')) {
        onPhoneChange(value.replace(/[\s-]/g, ''));
      } else {
        const formatted = formatPhoneInput(value);
        onPhoneChange(formatted.replace(/-/g, ''));
      }
    }

    const displayPhone = phone.startsWith('+') ? phone : formatPhoneInput(phone);
    ```

    전화번호 Input에 `autoComplete="tel"` 추가.

    **10. 국가 감지 안내 (인풋 row 바로 아래):**
    ```tsx
    {showCountryHint && locale.countryName && (
      <span
        className="text-caption text-gray-500"
        aria-live="polite"
      >
        {locale.countryName} 번호로 SMS를 발송합니다
      </span>
    )}
    {showCountryHint && !locale.countryName && (
      <span
        className="text-caption text-gray-500"
        aria-live="polite"
      >
        국제 번호로 SMS를 발송합니다
      </span>
    )}
    ```

    **11. 인증번호 input에 `autoComplete="one-time-code"` 추가**, 타이머 색 토큰 교정:
    ```tsx
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      /* ... */
    />
    {/* ... */}
    <div className="flex items-center gap-2">
      {timeLeft > 0 ? (
        <span className="text-caption text-error" aria-live="off">
          {formatTime(timeLeft)}
        </span>
      ) : (
        <span className="text-caption text-error" role="alert" aria-live="polite">
          시간 만료
        </span>
      )}
    </div>
    ```

    **12. verify error p에 alert 역할 추가:**
    ```tsx
    {verifyError && (
      <p
        className="text-caption text-error animate-in fade-in duration-150"
        role="alert"
        aria-live="assertive"
      >
        {verifyError}
      </p>
    )}
    ```

    **13. 루트 `<div className="space-y-3">` → `<div className="space-y-4">`**

    **14. Button size:** 발송 + 확인 모두 `size="lg"` (기존 `size="default"` 교체).

    **15. 인증 완료 표시:** `<div className="flex items-center gap-2" role="status">` 추가.

    **주의사항 / 금지 사항:**
    - 시도 횟수 UI 노출 절대 금지 (D-19)
    - "OTP", "PIN", "Twilio", "Infobip", "카카오알림톡" 등 용어/프로바이더명 사용 금지 (UI-SPEC)
    - 애니메이션 신규 추가 금지 (기존 `animate-in fade-in duration-150`만 유지)
    - `signup-step3.tsx` / `signup-form.tsx` / `callback/page.tsx` 수정 금지 (UI-SPEC §"Out of Scope" + §"변경 없음 (호출부)")
    - dark mode 대응 금지 (프로젝트 전역 미지원)
    - props 시그니처 변경 금지
    - E.164 정규화는 백엔드 parseE164가 담당 — 프론트는 raw passthrough (서버가 `sms:pin:{e164}` 키 일관성 보장)
  </action>
  <acceptance_criteria>
    - `grep -q "SMS_RESEND_COOLDOWN_SECONDS" apps/web/components/auth/phone-verification.tsx`
    - `grep -q "resendCooldown" apps/web/components/auth/phone-verification.tsx`
    - `grep -q "ApiClientError" apps/web/components/auth/phone-verification.tsx`
    - `grep -q "detectPhoneLocale" apps/web/components/auth/phone-verification.tsx`
    - `grep -q "mapErrorToCopy" apps/web/components/auth/phone-verification.tsx`
    - `grep -q "one-time-code" apps/web/components/auth/phone-verification.tsx`
    - `grep -q "autoComplete=\"tel\"" apps/web/components/auth/phone-verification.tsx`
    - `grep -q "space-y-4" apps/web/components/auth/phone-verification.tsx` AND `grep -qv "space-y-3" apps/web/components/auth/phone-verification.tsx` (루트 스택만 고려)
    - `grep -q "size=\"lg\"" apps/web/components/auth/phone-verification.tsx`
    - `grep -q "잠시 후 다시 시도해주세요" apps/web/components/auth/phone-verification.tsx`
    - `grep -q "인증번호가 만료되었습니다. 재발송해주세요" apps/web/components/auth/phone-verification.tsx`
    - `grep -q "인증번호가 일치하지 않습니다" apps/web/components/auth/phone-verification.tsx`
    - `grep -q "일시적인 오류가 발생했습니다" apps/web/components/auth/phone-verification.tsx`
    - `grep -q "재발송 대기 중" apps/web/components/auth/phone-verification.tsx` (aria-label)
    - `grep -q "국제 번호\|번호로 SMS를 발송합니다" apps/web/components/auth/phone-verification.tsx`
    - `grep -q "role=\"alert\"" apps/web/components/auth/phone-verification.tsx`
    - props 인터페이스 불변: `grep -q "interface PhoneVerificationProps" apps/web/components/auth/phone-verification.tsx` AND 5필드(phone/onPhoneChange/onVerified/isVerified/error) 유지
    - `pnpm --filter @grapit/web typecheck` exits 0
    - `pnpm --filter @grapit/web lint --max-warnings 0 components/auth/phone-verification.tsx` exits 0
    - `pnpm --filter @grapit/web test -- --run phone-verification` exits 0 (Plan 01 RED 테스트 GREEN 전환)
  </acceptance_criteria>
  <verify>
    <automated>pnpm --filter @grapit/web test -- --run phone-verification</automated>
  </verify>
  <requirements>SMS-01, SMS-02, SMS-04</requirements>
  <autonomous>true</autonomous>
  <commit>feat(10-08): rewrite phone-verification component — 4-state button + 30s cooldown + HTTP error mapping (D-18~D-20)</commit>
  <done>UI-SPEC contract 전부 구현, phone-verification.test.tsx GREEN, typecheck/lint green, 호출부 컴포넌트 무영향, 시도 횟수 노출 없음</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → apiClient (SMS endpoints) | fetch credentials: 'include', JSON body |
| server error → UI error copy | HTTP status 기반 카피 매핑, body.message 서버 인용 (CN 차단) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-08-01 | Information Disclosure | 시도 횟수/어포던스 노출 (D-19 위반) | mitigate | UI에 시도 횟수 미노출, 에러 카피는 만료/잠금/쿨다운 3가지만 구분 (D-20) |
| T-10-08-02 | Tampering | 30s 쿨다운 프론트 우회 (disabled 버튼 직접 호출) | mitigate | 서버 Valkey `sms:resend:{e164}` NX (Plan 05)로 최종 판정 — 프론트 disabled는 UX 가드 레이어 |
| T-10-08-03 | Input Validation bypass | 프론트 regex 우회로 악성 입력 전송 | accept | 서버 zod regex (Plan 06) + Infobip 서버 재검증으로 차단. 프론트는 UX 가이드 역할만 |
| T-10-08-04 | Information Disclosure | CN 차단 메시지 노출 시점 (UX 레퍼런스) | accept | UI-SPEC §"국가 감지 안내"대로 발송 시도 후 400 응답에서만 표시 (선제 차단 미제공) |
| T-10-08-05 | Spoofing | autoComplete=one-time-code 미작동 iOS | accept | iOS SMS 자동입력은 시스템 레벨 기능, 실패해도 수동 입력 가능 |
</threat_model>

<verification>
- `pnpm --filter @grapit/web typecheck` green
- `pnpm --filter @grapit/web lint --max-warnings 0` green (변경 파일 기준)
- `pnpm --filter @grapit/web test -- --run phone-verification` green (4-state, 쿨다운, 에러 카피 3종 테스트 통과)
- Manual smoke: signup 페이지에서 한국 번호 발송 → 쿨다운 30s 카운트다운 + 만료 02:59 카운트다운 동시 표시, 30s 후 재발송 활성 (개발자 수동 확인은 Wave 5에서)
- a11y: 쿨다운 버튼 aria-label "재발송 대기 중, Ns 남음" 존재, verify error p의 role="alert"
</verification>

<success_criteria>
- phone-verification.tsx가 UI-SPEC 계약 100% 반영
- 호출부(signup-step3, signup-form, callback/page) 및 props 불변
- 4-state 버튼 전환 정확, 30s 쿨다운 독립 타이머, 에러 카피 5종(429/410/422/400 CN/400 invalid/5xx) 분기
- 시도 횟수 UI 노출 없음 (D-19)
- typecheck/lint/unit test 모두 green
- CONTEXT D-18, D-19, D-20 및 UI-SPEC 모든 "강한" 요구사항 구현
</success_criteria>

<output>
After completion, create `.planning/phases/10-sms/10-08-SUMMARY.md` with:
- 버튼 4-state 구현 방식 (조건부 렌더링)
- 타이머 2종(만료/쿨다운) 독립 useEffect 구조
- HTTP 상태 → 카피 매핑 테이블
- 국가 감지 안내 표시 조건 (KR/CN 제외)
- UI-SPEC 대비 커버리지 (space-y, text-caption, size="lg" 교정 포함)
</output>
