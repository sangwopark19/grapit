# Quick Task: 국제 전화번호 입력 UX 개선 — 국가코드 선택 라이브러리 도입

**Researched:** 2026-04-17
**Domain:** React 19 + Next.js 16 + shadcn/ui 기반 국제 전화번호 입력 UI
**Confidence:** HIGH (Context7 + 공식 문서 + npm registry 교차 검증 완료)

---

## Summary

사용자 피드백(2026-04-17 Phase 10.1 UAT Test 4 Gap)은 "libphonenumber-js의 *자동 감지* 텍스트 안내로는 국제 번호 입력 UX가 열악하다 — 국가를 **명시적으로 선택**할 수 있는 UI가 필요하다"는 것이다. 현재 `phone-verification.tsx`는 raw text input + `detectPhoneLocale` 유틸에 의존하여 사용자가 `+1`, `+86`, `+82` 같은 다이얼 코드를 직접 타이핑해야 하고, 한국 번호 외에는 포맷 힌트조차 주지 않는다.

2026-04 기준 React 19 + Next.js 16 App Router + shadcn/ui new-york + Tailwind v4 스택에서 **실전 투입 가능한 선택지는 3개**로 압축된다 (데이터는 모두 2026-04-15 npm registry / GitHub API 기준):

| 라이브러리 | npm v | 주간 DL | GH Star | 마지막 커밋 | React 19 | 한국어 locale |
|---|---|---|---|---|---|---|
| **react-phone-number-input** | 3.4.16 | 1.88M | 959 | 2026-02-27 | `>=16.8` | ✓ 공식 `locale/ko.json` |
| react-international-phone | 4.8.0 | 365K | 440 | 2026-02-22 | `^19.0.0` 명시 | ✗ (Twemoji + 영어) |
| intl-tel-input (vanilla) | 27.0.10 | 918K | 8,191 | 2026-04-15 | React wrapper 없음 | 별도 작업 |

**Primary recommendation:** `react-phone-number-input` (3.4.16) + **shadcn/ui 스타일 wrapper를 직접 작성**하는 하이브리드 접근. 프로젝트에 이미 설치된 `libphonenumber-js ^1.12.41`과 **엔진을 공유**하고(중복 다운로드 없음), 공식 **한국어 locale 파일을 제공**하며, `getCountries()` / `getCountryCallingCode()` 저수준 API로 shadcn `Popover + Command` 드롭다운을 자유롭게 구성할 수 있다. 백엔드 `parseE164` / `isChinaMainland`(`apps/api/src/modules/sms/phone.util.ts`)와 E.164 계약이 **그대로 유지**된다 (라이브러리 `onChange` 반환값이 이미 E.164 문자열).

[CITED: https://www.npmjs.com/package/react-phone-number-input] [CITED: https://github.com/omeralpi/shadcn-phone-input]

---

## User Constraints (from Quick Task brief)

### Locked Decisions (prompt `<constraints>`)

- Next.js 16, React 19, Tailwind v4 CSS-first, shadcn/ui new-york preset, lucide icons, Pretendard 폰트 호환 필수
- 기존 `libphonenumber-js ^1.12.41` 활용 (중복 설치 피함)
- Props 인터페이스 보존: `phone`, `onPhoneChange`, `onVerified(code)`, `isVerified`, `error` — `signup-step3.tsx` / `callback/page.tsx` 무영향
- UI-SPEC 10 계약 보존: 4-state 재발송, 30s 쿨다운, 3분 만료, role="alert"/"status", autoComplete, D-19(시도 횟수 미노출)
- 백엔드 `apps/api` 무영향 (parseE164 / isChinaMainland / InfobipClient 절대 건드리지 않음)
- E2E 테스트 `apps/web/e2e/signup-sms.spec.ts` 통과: 한국 번호 `010-0000-0000` placeholder 존재, 000000 mock code 플로우
- 현재 세션 상태: Phase 10.1 PR #16 shipped, Phase 11 대기 중 — quick task로 phone-verification UX만 교체

### Claude's Discretion

- 라이브러리 선택: 3개 후보 중 최적안 권고
- 한국 번호 기본값(defaultCountry="KR") + 국가 목록 필터링 범위
- `detectPhoneLocale` 유틸 제거 vs 유지 (백엔드 호환용 `e164` 생성만 필요)
- 중국 본토(+86) 블로킹 지점: 프론트 드롭다운에서 제외 vs 백엔드 400 응답 유지

### Deferred / Out of Scope

- UI-SPEC의 "Out of Scope for Phase 10 UI" 항목 (음성 OTP, SMS 자동 파싱, 다크모드 등)
- 국가 localization을 i18n 시스템으로 확장 (현재는 하드코딩 ko 라벨로 충분)
- 백엔드 SMS 프로바이더 변경

---

## Library Comparison Table

### 정량 데이터 (2026-04-17 기준)

| 항목 | react-phone-number-input | react-international-phone | intl-tel-input (vanilla) |
|---|---|---|---|
| npm 최신 버전 | 3.4.16 (2026-02-23) | 4.8.0 (2026-02-21) | 27.0.10 (2026-04-15) |
| 주간 다운로드 | **1,876,708** | 364,910 | 917,745 |
| 월간 다운로드 | 7.4M | 1.5M | 3.8M |
| GitHub stars | 959 | 440 | **8,191** |
| 마지막 push | 2026-02-27 | 2026-02-22 | **2026-04-15** |
| Open issues | 28 | 61 | 1 |
| peer React | `>=16.8` | `^16.8.0 \|\| ^17 \|\| ^18 \|\| ^19` | N/A (vanilla JS) |
| 번들 gzip | ~47.8kb | ~60kb (추정) | ~50kb JS + CSS |
| libphonenumber-js 내장 | ✓ (^1.12.37) | ✓ | ✓ (3.0 이상은 자체 포크) |
| License | MIT | MIT | MIT |

[VERIFIED: npm registry + GitHub API, 2026-04-15/17]

### 정성 평가 (Next.js 16 / React 19 / Tailwind v4 / shadcn/ui new-york 적합성)

| 평가 축 | react-phone-number-input | react-international-phone | intl-tel-input |
|---|---|---|---|
| React 19 공식 호환 | peer `>=16.8` (호환) | peer에 `^19.0.0` 명시 | 래퍼 없음 — 직접 통합 필요 |
| Next.js 16 App Router SSR | CSS 클래스 기반, `'use client'` 필요 | 동일 ('use client') | DOM API 직접 조작 — `'use client'` + mount 후 init |
| Tailwind v4 호환 | ✓ (CSS 클래스 override, 또는 shadcn wrapper 권장) | ✓ (CSS 변수 기반 override) | ✗ (자체 CSS가 Tailwind 토큰과 충돌) |
| shadcn new-york 미학 적합성 | **최고 — omeralpi/shadcn-phone-input 레퍼런스 있음** | 중간 (CSS 변수 override로 가능하나 자체 외관이 강함) | 하 (iti 고유 디자인이 시각적으로 지배) |
| 한국어 지원 | **`locale/ko.json` 공식 제공 (276개 국가명 한국어)** | 영어만 (Twemoji) — 수동 매핑 필요 | `i18n` 프롭으로 가능하나 공식 ko JSON 없음 |
| onChange 반환 포맷 | **E.164 문자열** (백엔드 계약과 정합) | v4부터 E.164 (마이그레이션 필요 — v3는 다른 포맷) | raw input (getNumber() 별도 호출 필요) |
| 접근성 (ARIA) | Select `<button>` + 공식 a11y 가이드 | 자체 구현 (버튼+드롭다운) | `inputmode="tel"` 기본, 나머지는 앱 책임 |
| 커스텀 컴포넌트 slot | `inputComponent`, `flagComponent`, `countrySelectComponent` 등 **완전 교체 가능** | `countrySelectorStyleProps` 로 제한적 | 거의 불가 (렌더링은 vanilla) |
| drizzle-zod / zod 통합 | `isValidPhoneNumber` 헬퍼 제공 → zod `.refine()` | `usePhoneInput` hook 노출 | N/A |
| 회귀 위험 (UI-SPEC 10 계약) | **낮음** — Input/Button 쉘은 기존 shadcn 컴포넌트 재사용 | 중간 — 자체 스타일 레이어 우회 필요 | 높음 — DOM 구조가 바뀜 |

[CITED: Context7 /catamphetamine/react-phone-number-input] [CITED: Context7 /ybrusentsov/react-international-phone] [CITED: Context7 /jackocnr/intl-tel-input] [CITED: Context7 /omeralpi/shadcn-phone-input]

### 빠른 판정 매트릭스

| 기준 | react-phone-number-input | react-international-phone | intl-tel-input | 직접 구현 |
|---|---|---|---|---|
| 엔진 중복 회피 (libphonenumber-js 공유) | ✓ | ✓ | ✗ (자체 포크) | ✓ |
| 한국어 국가명 제공 | ✓ (공식) | ✗ | △ | 수동 |
| shadcn new-york 외관 | ✓✓ (레퍼런스 wrapper 존재) | △ | ✗ | ✓✓ |
| props 교체 난이도 | **낮음** (inputComponent 등) | 중간 | 높음 | N/A |
| 중국(+86) 제외 간단한가 | ✓ (metadata 필터 or `countries` prop) | ✓ (`countries`) | ✓ (`excludeCountries`) | ✓ |
| 유지보수 최근성 | 월간 업데이트 | 월간 업데이트 | **가장 활발** | 자체 유지 |
| 작업 복잡도 (phase 10.1 회귀 위험) | **중** | 중 | 고 | 고 |

---

## Recommendation

### 1위: **react-phone-number-input + shadcn wrapper** (권고 채택)

**근거 5줄:**

1. **엔진 재사용** — 프로젝트에 `libphonenumber-js ^1.12.41`이 이미 설치되어 있고, 백엔드 `parseE164`/`isChinaMainland`도 동일 엔진. `react-phone-number-input`의 dependency도 `libphonenumber-js ^1.12.37`이라 메이저 버전이 정렬됨 — 번들 중복 없음 (~328KB libphonenumber-js는 **단 1회만 포함**).
2. **E.164 계약 유지** — `onChange((value: E164Number | undefined) => void)` 콜백이 `+821012345678` 같은 E.164 문자열을 그대로 반환. 현재 `phone` state(String) → 백엔드 `POST /api/v1/sms/send-code { phone }` 계약이 **수정 없이 유지**됨. `signup-step3.tsx:66` `handlePhoneVerified(code)` 인터페이스 무영향.
3. **한국어 locale 공식 제공** — `react-phone-number-input/locale/ko.json`이 276개 국가를 한국어로 제공 (예: `"KR": "대한민국"`, `"US": "미국"`, `"CN": "중국"`, `"HK": "홍콩 특별행정구"`, `"TW": "대만"`). `labels={ko}` 한 줄로 드롭다운/툴팁/ARIA 전체가 한국어화.
4. **shadcn new-york 매칭 레퍼런스 존재** — `omeralpi/shadcn-phone-input` (GH 952★)이 `Popover + Command + ScrollArea + CommandInput` 조합으로 신로크 컨트롤에 통합된 ready-made 구현을 제공. `components.json`이 new-york preset이고 이미 `radix-ui`, `@radix-ui/react-dialog`, `lucide-react`가 설치되어 있어 추가 의존성은 `cmdk` (Command 원본) + shadcn Popover/Command/ScrollArea 3개 스니펫뿐.
5. **회귀 위험 최소** — `inputComponent` prop으로 기존 `@/components/ui/input`을 그대로 주입 가능 → UI-SPEC 10의 `text-caption`, `h-11`, `focus-visible:ring-primary` 등 **모든 Tailwind 토큰이 무변경 적용**. 쿨다운 버튼/타이머/role="alert" 등 contract는 드롭다운 바깥쪽 로직이라 영향 없음.

**위험과 완화:**
- **입력 재포맷팅 중 caret 이슈** (`smartCaret={false}` prop으로 비활성화하는 것이 shadcn 레퍼런스의 기본값)
- **빈 값에서 `onChange(undefined)` 발생** — shadcn 레퍼런스가 이미 `value || ""` 강제 변환 패턴 제공
- **Phase 10 UI-SPEC의 "010-0000-0000" placeholder** — PhoneInput의 `placeholder` prop으로 유지 가능 (한국 기본 선택 시 placeholder 표시됨)

[CITED: https://www.npmjs.com/package/react-phone-number-input] [CITED: https://gitlab.com/catamphetamine/react-phone-number-input] [CITED: https://github.com/omeralpi/shadcn-phone-input]

### 2위: react-international-phone (대안)

- **장점:** Twemoji 플래그가 내장 SVG 번들 (국내 CDN 이슈 없음), React 19를 peer에 명시, `forceDialCode` + `preferredCountries` 같은 UX 프롭이 내장.
- **단점:** 한국어 국가명 **지원 안 됨** — `COUNTRY_NAME_KO` 매핑(276개 국가)을 프로젝트가 자체 관리해야 함. shadcn new-york 외관과 매칭하려면 CSS 변수 override가 필요한데, 자체 `.react-international-phone-*` 네임스페이스가 더 강함. **사용자 피드백이 "명시적 국가 선택"에 대한 것인데, 한국어가 안 되면 UX 개선 효과가 반감됨**.
- **채택 시점:** 한국어 locale 이슈를 별도 매핑 테이블로 해결할 수 있고, `forceDialCode` 같은 단일 행동 UX가 더 중요한 경우.

### 3위: intl-tel-input

- **장점:** 가장 활발한 유지보수 (2026-04-15 push, GH 8.2K stars, open issue 단 1개), CSS 분리 깔끔.
- **단점:** **Vanilla JS** — React 래퍼가 없고, DOM 직접 조작이라 `useEffect`로 감싸야 함. SSR 시 초기 렌더 깜빡임 위험. `react-intl-tel-input` 래퍼는 2024 이전 deprecated (유지보수 중단). shadcn 재스타일링 비용도 가장 높음.
- **채택 시점:** 프로젝트가 vanilla JS 중심이거나, iti의 특정 기능(예: 다이얼 코드 자동 추출)이 꼭 필요한 경우만. React 프로젝트에 권장되지 않음.

### 4위: 직접 구현 (shadcn Command 기반)

- **장점:** 외부 의존성 0, 번들 최소.
- **단점:** 276개 국가 목록 + dial code 매핑 + E.164 파싱 + validation을 **직접 유지보수**해야 함. `libphonenumber-js`에 이미 `getCountries()`, `getCountryCallingCode()`가 있지만, 국가명 localization, 플래그 에셋, 검색 UI, "type-as-you-go" 포맷팅 등을 모두 조립해야 함. 1인 개발 constraint(CLAUDE.md "복잡도 최소화")에 **역행**.
- **채택 시점:** `react-phone-number-input`에 **블로킹 버그**가 있을 때만 fallback.

### 최종 판정

| 점수 기준 (5점 만점) | RPN-I (1위) | RIP (2위) | iti (3위) | 직접 구현 (4위) |
|---|---|---|---|---|
| 기존 스택 적합성 | 5 | 3 | 2 | 3 |
| 구현 시간 (1인 개발) | 4 | 3 | 2 | 1 |
| 한국어 UX | 5 | 2 | 3 | 3 |
| 회귀 위험 최소화 | 5 | 3 | 2 | 4 |
| 유지보수 지속성 | 4 | 4 | 5 | 1 |
| **합계 (25점)** | **23** | 15 | 14 | 12 |

---

## Integration Sketch

### 교체 범위 (파일 단위)

| 파일 | 조치 |
|---|---|
| `apps/web/components/auth/phone-verification.tsx` | **핵심 수정** — 전화번호 Input 블록(라인 210-243)을 새 `<PhoneInput>` wrapper로 교체. 코드 입력 row/버튼/타이머/에러 메시지 로직은 **전부 유지**. |
| `apps/web/components/ui/phone-input.tsx` | **신규 작성** — `omeralpi/shadcn-phone-input` 템플릿 복사 후 Grapit 토큰(`text-caption`, `h-11`, `focus-visible:ring-primary`, `border-gray-200`)으로 조정. |
| `apps/web/components/ui/popover.tsx` | **신규 (shadcn add)** — `npx shadcn@latest add popover` |
| `apps/web/components/ui/command.tsx` | **신규 (shadcn add)** — `npx shadcn@latest add command` (`cmdk` 의존성 자동 설치) |
| `apps/web/components/ui/scroll-area.tsx` | **신규 (shadcn add)** — `npx shadcn@latest add scroll-area` |
| `apps/web/lib/phone.ts` | **축소 유지** — `detectPhoneLocale` 제거. 한국어 라벨 매핑은 `locale/ko.json` 사용으로 불필요해짐. 단, 백엔드가 그대로 E.164를 기대하므로 로컬 포맷 정규화 함수는 유지하거나 `formatPhoneNumber` 유틸로 대체 가능. |
| `apps/web/components/auth/__tests__/phone-verification.test.tsx` | **13개 중 3~5개 수정** (아래 Pitfalls 섹션 참조) |
| `apps/web/e2e/signup-sms.spec.ts` | **수정 불필요** — placeholder `010-0000-0000` 유지 가능 (한국 기본 선택 시 `metadata` placeholder가 그대로 노출), fill value `01012345678`은 E.164 `+821012345678`로 내부 정규화되어 서버 전달 |
| `apps/web/package.json` | `react-phone-number-input` 추가 (`^3.4.16`), `cmdk` 추가 (shadcn Command가 peer로 요구) |
| `apps/api/**` | **절대 수정 금지** (constraint) — `parseE164`가 입력 `+821012345678`를 그대로 passthrough 처리 |

### 핵심 통합 코드 스케치

**`apps/web/components/ui/phone-input.tsx`** (신규 — shadcn new-york 스타일):

```tsx
'use client';
import * as React from 'react';
import { CheckIcon, ChevronsUpDown } from 'lucide-react';
import * as RPNInput from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import ko from 'react-phone-number-input/locale/ko.json';
import 'react-phone-number-input/style.css'; // 최소 필수 CSS (dropdown arrow 등)

import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/cn';

type PhoneInputProps = Omit<
  React.ComponentProps<'input'>,
  'onChange' | 'value' | 'ref'
> & {
  value: string;
  onChange: (value: string) => void;
};

export const PhoneInput = React.forwardRef<
  React.ElementRef<typeof RPNInput.default>,
  PhoneInputProps
>(({ className, onChange, value, ...props }, ref) => (
  <RPNInput.default
    ref={ref}
    className={cn('flex', className)}
    labels={ko}                            /* ★ 한국어 국가명 */
    defaultCountry="KR"                     /* ★ 한국 기본 */
    international                           /* E.164 강제 */
    flagComponent={FlagComponent}
    countrySelectComponent={CountrySelect}
    inputComponent={InputComponent}
    smartCaret={false}                      /* caret 이슈 회피 */
    value={value || undefined}
    onChange={(v) => onChange(v ?? '')}
    {...props}
  />
));

const InputComponent = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'>
>(({ className, ...props }, ref) => (
  <Input
    {...props}
    ref={ref}
    className={cn('rounded-e-lg rounded-s-none', className)} /* ← 기존 h-11, focus-ring 상속 */
  />
));

// CountrySelect는 Popover + Command (omeralpi 템플릿 그대로)
// — CommandInput placeholder를 "국가 검색..."으로 한국어화
```

**`apps/web/components/auth/phone-verification.tsx`** 교체 지점:

```tsx
// BEFORE (line 211-220)
<div className="flex gap-2">
  <Input type="tel" autoComplete="tel" placeholder="010-0000-0000" value={displayPhone} ... />
  <Button ...>인증번호 발송</Button>
</div>

// AFTER
<div className="flex gap-2">
  <PhoneInput
    value={phone}                          /* E.164 문자열, 비어있으면 "" */
    onChange={onPhoneChange}
    placeholder="전화번호 입력"
    autoComplete="tel"
    disabled={isVerified}
    className="flex-1"
  />
  <Button ...>인증번호 발송</Button>
</div>
```

### 백엔드 계약 확인 (E.164)

| 입력 UI 상태 | `phone` state 값 | `POST /api/v1/sms/send-code` 바디 | 백엔드 `parseE164` 동작 |
|---|---|---|---|
| 한국 기본 + "01012345678" 입력 | `+821012345678` | `{ phone: "+821012345678" }` | E.164 passthrough → OK |
| 중국 선택 + "13812345678" 입력 | `+8613812345678` | `{ phone: "+8613812345678" }` | `parsePhoneNumberWithError` → `country: 'CN'` → `isChinaMainland` true → 400 "중국 본토..." |
| 미국 선택 + "2025550123" 입력 | `+12025550123` | `{ phone: "+12025550123" }` | E.164 passthrough → OK |
| 홍콩 선택 + "91234567" 입력 | `+85291234567` | `{ phone: "+85291234567" }` | E.164 passthrough → OK (isChinaMainland = false) |

**계약 변경 없음** — 기존 `mapErrorToCopy`의 `err.message.includes('중국 본토')` 분기가 그대로 작동한다 (백엔드가 한국어 에러 메시지를 바디로 내려주므로 [VERIFIED: `apps/api/src/modules/sms/phone.util.ts:46`의 `'올바른 휴대폰 번호를 입력해주세요'` + sms.service.ts의 D-03 메시지]).

### 중국(+86) 차단 지점 판단

- **프론트 드롭다운에서 CN 제외** = **비권장**. 이유: (a) 백엔드 에러 메시지 "다른 국가 번호로 가입해 주세요" (D-03) 안내가 사라짐, (b) 홍콩/마카오/대만은 구분해서 허용해야 하는데 필터 구현 복잡, (c) UI-SPEC 10 Color 테이블이 이미 "중국 본토 차단은 `text-error` 메시지"로 contract 고정.
- **백엔드 400 응답 유지** = **권장**. 이유: 현재 `phone-verification.tsx:28` 이 이미 `err.message.includes('중국 본토')` 분기를 갖고 있고, D-03 계약이 Phase 10.1까지 프로덕션 검증됨. 드롭다운에는 CN을 **보여주되 선택 시 서버가 막는** 기존 플로우 유지. 사용자가 "왜 선택할 수 있는데 막히지?"를 느낄 수 있으나, 이는 Phase 12 UX 현대화 스코프.

### `apps/web/lib/phone.ts` 축소 계획

```diff
- import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
- export interface PhoneLocale { ... }
- const COUNTRY_NAME_KO: Record<string, string> = { ... };
- export function detectPhoneLocale(input: string): PhoneLocale { ... }
+ // phone.ts는 deprecated. 국가명은 react-phone-number-input/locale/ko.json 사용.
+ // 국가 감지 로직은 PhoneInput 컴포넌트가 대체.
```

테스트 파일이 `vi.mock('@/lib/phone', ...)`로 `detectPhoneLocale`을 mock하고 있으므로, **파일은 남기되 함수를 no-op 스텁으로 교체**하거나 테스트에서 mock을 제거한다.

---

## Pitfalls

### P1: SSR hydration mismatch (HIGH 위험)

**원인:** `react-phone-number-input`은 초기 렌더에서 `defaultCountry="KR"` 이 선택되지만, 서버 렌더 시점에 사용자 locale을 알 수 없어 서버/클라이언트 HTML이 달라질 가능성.

**완화:**
1. `phone-verification.tsx`는 이미 `'use client'` 디렉티브가 있음 (라인 1) — RSC tree에 포함되지 않음.
2. 호출부 `signup-step3.tsx`도 `'use client'` (라인 1) — 컴포넌트 전체가 클라이언트 렌더.
3. App Router 기본 `next build` 시 `/auth/signup` 페이지는 서버에서 HTML shell만 생성, PhoneInput은 클라이언트에서 마운트됨 — **hydration mismatch 가능성 없음**.

[CITED: https://nextjs.org/docs/app/getting-started/server-and-client-components]

### P2: 기존 테스트 13개 중 수정 필요한 가정 (MEDIUM 위험)

`apps/web/components/auth/__tests__/phone-verification.test.tsx` 분석:

| 테스트 | 깨짐 여부 | 사유 / 수정 방향 |
|---|---|---|
| "인증번호 발송" 버튼 존재 | 통과 유지 | 버튼 컴포넌트는 교체 대상 아님 |
| 인증번호 입력 필드 초기 숨김 | 통과 유지 | 동일 |
| 30초 쿨다운 라벨 | 통과 유지 | 동일 |
| 쿨다운 종료 후 재발송 활성 | 통과 유지 | 동일 |
| 429 에러 카피 | 통과 유지 | `mapErrorToCopy` 그대로 |
| 410 에러 카피 | 통과 유지 | 동일 |
| 400 에러 카피 | 통과 유지 | 동일 |
| **국가 감지 "+66 태국..."** | **FAIL 예상** | `vi.mock('@/lib/phone')`로 `detectPhoneLocale` 반환값을 조작해왔으나, 새 UI는 **`detectPhoneLocale`을 사용하지 않음**. 이 테스트는 **제거 또는 새 UX용으로 재작성** (드롭다운 클릭 → 태국 선택 → 인풋 텍스트 `+66 8 1234 5678` 검증). UI-SPEC 10의 "국가 감지 안내" 문구도 이제 PhoneInput 자체 dial code 프리픽스로 대체됨. |
| D-19 시도 횟수 미노출 | 통과 유지 | 동일 |
| autoComplete="one-time-code" (코드 인풋) | 통과 유지 | 동일 (전화번호 autoComplete는 별개) |
| aria-label 재발송 대기 | 통과 유지 | 동일 |
| role="alert" | 통과 유지 | 동일 |

**추정 테스트 수정 규모:** 1~2개 (국가 감지 테스트 + 전화번호 input placeholder 관련). `vi.mock('@/lib/phone', ...)` 전체 블록은 제거 가능.

### P3: `libphonenumber-js` 번들 크기 (LOW 위험)

- 현재 프로젝트: `libphonenumber-js/min` import (~75-80KB)
- react-phone-number-input: `libphonenumber-js/max` (기본) 또는 `/min`, `/core`, `/mobile` subset 선택 가능
- **권장:** `react-phone-number-input/min` entry point 사용 → `libphonenumber-js/min` metadata만 로드 → **중복 번들 증가 0**
- 예상 net increase: ~**50kb gzip** (react-phone-number-input 47.8kb + flags SVG 수KB + cmdk + @radix/popover는 이미 Radix 설치됨)
- Twemoji SVG 플래그는 `country-flag-icons`에서 `<img src="cdn.jsdelivr.net/...">` 로딩 — **국내 접속 이슈 검토 필요**. 대안: `react-phone-number-input/flags` 서브패키지 (SVG 번들 포함, 네트워크 요청 없음).

[CITED: https://www.npmjs.com/package/react-phone-number-input#subset]

### P4: `react-phone-number-input`의 `onChange(undefined)` 동작 (LOW 위험)

- 빈 값/invalid 값일 때 `onChange`가 `undefined`를 호출함
- shadcn 레퍼런스의 `(value) => onChange?.(value || '')` 패턴으로 empty string 강제
- `phone-verification.tsx`의 `onPhoneChange`는 이미 string 시그니처 — 문제없음

### P5: CDN 플래그 로딩 속도 (LOW 위험)

- react-phone-number-input은 **기본으로 `flagUrl="https://purecatamphetamine.github.io/country-flag-icons/3x2/{XX}.svg"`** 사용
- GitHub Pages는 Korea 접속에서 간헐적 지연 가능
- **완화:** `react-phone-number-input/flags` 경로에서 React SVG 컴포넌트 import 시 번들에 인라인됨 → 네트워크 요청 없음 (shadcn 레퍼런스가 이미 이 방식 사용)

### P6: 한국 placeholder `010-0000-0000` 유지 (MEDIUM 위험)

- UI-SPEC 10과 E2E 테스트 모두 `010-0000-0000` placeholder를 기대
- PhoneInput의 `placeholder` prop으로 유지 가능하지만, 라이브러리가 기본 placeholder를 **메타데이터 기반 샘플 번호**로 오버라이드할 수 있음 (옵션에 따라)
- **확인 필요:** `withMetadata` / `smartCaret` 조합에 따른 placeholder 동작. Plan 단계에서 실제 렌더링 확인 후 `placeholder="010-0000-0000"` 고정 여부 결정.

### P7: cmdk 버전 pinning 경고

- shadcn-phone-input README 경고: **"double-check that you're using version 1.0.0 of the cmdk package"**
- 최신 cmdk는 0.9 → 1.0으로 breaking change가 있을 수 있으니 설치 시 버전 확인 필수

### P8: 현재 E2E 선택자 의존성

`apps/web/e2e/signup-sms.spec.ts`:
- `page.getByPlaceholder('010-0000-0000')` — placeholder 유지 시 통과
- `page.getByRole('button', { name: '인증번호 발송' })` — 영향 없음
- `phoneInput.fill('01012345678')` — PhoneInput은 raw 숫자 입력을 받아 내부에서 `+82` 프리픽스를 붙임 (한국 기본 선택 시) → 서버는 `+821012345678` 수신 → 백엔드 `parseE164`는 E.164 passthrough → OK
- **리스크:** PhoneInput의 국가 셀렉터 버튼이 왼쪽에 붙으면서 `getByPlaceholder`가 input 내부를 타겟팅하지 못하는 경우 발생 가능. Plan 단계에서 `data-testid="phone-input"` 추가 권장.

---

## Assumptions Log

| # | 가정 | 섹션 | 잘못되었을 때 영향 |
|---|---|---|---|
| A1 | `react-phone-number-input 3.4.16`이 React 19 strict mode에서 hydration 에러 없이 동작 | Recommendation | 직접 테스트 후 확인 필요. 문제 시 v4 후보 fallback |
| A2 | `cmdk` 1.0이 React 19와 호환됨 | P7 | cmdk 최신 버전 설치 후 smoke 테스트로 확인 |
| A3 | UI-SPEC 10의 "국가 감지 안내" 섹션(`"태국 번호로 SMS를 발송합니다"`)은 드롭다운으로 대체되므로 제거 가능 | Integration Sketch | UI-SPEC 10은 Phase 10에서 "planner 재량 — Discretion"으로 표기된 영역이므로 제거 가능 판단 |
| A4 | 현재 `phone-verification.test.tsx`의 `vi.mock('@/lib/phone')` 테스트 중 국가 감지 검증(line 193-197) **1개만 제거/재작성** 필요 | P2 | 실제 실행 시 추가 테스트 충돌 가능 — Plan에서 test suite 재실행 검증 |
| A5 | `libphonenumber-js ^1.12.41` (현재) + react-phone-number-input 내부 `^1.12.37` dependency가 pnpm의 peer 해결로 **단일 인스턴스로 hoist**됨 | P3 | `pnpm ls libphonenumber-js` 확인 필요, 중복 시 package.json `resolutions` 추가 |

---

## Open Questions

1. **`libphonenumber-js/min` vs `/max` 선택**
   - 현재 프로젝트: `/min` (75-80KB, 국가별 example 번호 미포함)
   - react-phone-number-input 기본: 메타데이터 min 내장 (자체 bundle)
   - **권장:** Plan에서 `react-phone-number-input/min` entry를 import하여 min 메타데이터와 정합

2. **Korean locale file 번들 크기**
   - `locale/ko.json`: 약 10-15KB (276개 국가명 + 기타 레이블)
   - static JSON import로 tree-shake되어 필요한 국가만 번들에 포함되는가? → **확인 필요** (Plan 단계에서 bundle analyzer 실행)

3. **`autoComplete="tel"`가 PhoneInput의 inputComponent로 전달되는지**
   - 현재 `phone-verification.tsx:214` `autoComplete="tel"` 유지 필요 (UI-SPEC contract)
   - PhoneInput의 `{...props}` spread가 inputComponent까지 전달되는지 확인 필요

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| React 19 | PhoneInput, shadcn blocks | ✓ | 19.1.0 (apps/web/package.json:33) | — |
| Next.js 16 | App Router | ✓ | 16.2.0 | — |
| libphonenumber-js | react-phone-number-input 내부 dep | ✓ | 1.12.41 | — |
| @radix-ui/react-popover | shadcn Popover | ✗ | — | `npx shadcn@latest add popover` (자동) |
| cmdk | shadcn Command | ✗ | — | `npx shadcn@latest add command` 시 자동 설치 |
| @radix-ui/react-scroll-area | shadcn ScrollArea | ✗ | — | `npx shadcn@latest add scroll-area` |
| react-phone-number-input | PhoneInput | ✗ | — | `pnpm add react-phone-number-input` |
| country-flag-icons | rpni transitive dep | ✗ | — | 자동 설치 |

**Missing dependencies with no fallback:** 없음 (모두 npm / shadcn CLI로 설치 가능)

**Missing dependencies with fallback:** 모든 항목 자동 해결

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | vitest 3.x (unit) + Playwright 1.59 (E2E) |
| Config file | `apps/web/vitest.config.ts` (추정 존재) + `apps/web/playwright.config.ts` |
| Quick run command | `pnpm --filter @grapit/web test` |
| E2E command | `pnpm --filter @grapit/web test:e2e` |

### Quick-Task Test Map

| 검증 항목 | 테스트 유형 | 자동화 명령 | 현재 존재? |
|---|---|---|---|
| PhoneInput이 한국 기본 선택 + placeholder 렌더 | unit | `pnpm --filter @grapit/web test phone-verification` | ✅ (수정) |
| "+86 선택 → 서버 400" 중국 차단 플로우 | unit (mock) | 기존 test.tsx 재활용 | ✅ |
| 드롭다운 클릭 → 국가 검색 "미국" → 선택 | unit | 신규 추가 필요 | ❌ 추가 작성 |
| E.164 포맷 E2E 검증 (000000 mock code + 한국 번호) | e2e | `signup-sms.spec.ts` 유지 | ✅ |
| 접근성 role="alert", aria-label (UI-SPEC 변경 없음) | unit | 기존 테스트 유지 | ✅ |

### Sampling Rate

- **Per task commit:** `pnpm --filter @grapit/web test -- phone-verification`
- **Per wave merge:** `pnpm --filter @grapit/web test && pnpm --filter @grapit/web test:e2e -- signup-sms`
- **Quick-task gate:** 전체 테스트 green 후 사용자 smoke test (개발 서버 8080+3000에서 +66/+1/+86 수동 검증)

### Wave 0 Gaps

- [ ] `apps/web/components/ui/popover.tsx` — shadcn add
- [ ] `apps/web/components/ui/command.tsx` — shadcn add
- [ ] `apps/web/components/ui/scroll-area.tsx` — shadcn add
- [ ] `apps/web/components/ui/phone-input.tsx` — omeralpi 템플릿 포트
- [ ] `apps/web/components/auth/__tests__/phone-verification.test.tsx` — 국가 감지 테스트 재작성 (드롭다운 상호작용 기반)

---

## Security Domain (Applicable — auth 플로우)

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes (SMS OTP flow) | 기존 — phase 10/10.1에서 구현 (Infobip, PIN 6자리, 3분 TTL, argon2 저장) |
| V4 Access Control | no | 이 quick task는 UI만 변경 |
| V5 Input Validation | yes | `react-phone-number-input`의 E.164 검증 + 백엔드 `parseE164` 재검증 (double validation) |
| V6 Cryptography | no | — |

### Known Threat Patterns for phone-input UX

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Client-side validation bypass (invalid E.164를 서버 전송) | Tampering | 백엔드 `parseE164`가 `ParseError` throw → 400 응답 (기존 동작 유지) |
| Phone enumeration (SMS 폭탄) | DoS | phase 10.1에서 이미 구현된 ThrottlerGuard + 30s 쿨다운 (UI 측) |
| Country bypass (중국 본토 → 홍콩 위장) | Tampering | `isChinaMainland`가 `parsed.country === 'CN'` 검증 — 라이브러리 앞단 변경 없음 |

### UI 변경이 기존 D-03/D-19 위협 완화를 약화시키지 않는지 확인

- **D-03 중국 본토 차단** — 변경 없음 (백엔드 400 응답 + 에러 메시지 분기 유지)
- **D-19 시도 횟수 미노출** — 변경 없음 (PhoneInput은 카운트 표시 안 함)
- **D-11 쿨다운 30초** — 변경 없음 (재발송 버튼 로직 유지)

---

## Sources

### Primary (HIGH confidence)

- Context7 `/catamphetamine/react-phone-number-input` — basic usage, labels prop, inputComponent slot, CSS customization [VERIFIED 2026-04-17]
- Context7 `/ybrusentsov/react-international-phone` — CSS variable override, onChange E.164 v4, custom flags [VERIFIED 2026-04-17]
- Context7 `/omeralpi/shadcn-phone-input` — Popover+Command 통합 레퍼런스 구현 [VERIFIED 2026-04-17]
- Context7 `/jackocnr/intl-tel-input` — vanilla JS API surface [VERIFIED 2026-04-17]
- npm registry API — version, dependencies, download counts (2026-04-09~15) [VERIFIED 2026-04-17]
- GitHub API — stars/issues/pushed dates (2026-04-17) [VERIFIED 2026-04-17]
- GitLab `catamphetamine/react-phone-number-input/locale/ko.json` — 공식 한국어 locale 276개 국가 [VERIFIED via raw fetch 2026-04-17]

### Secondary (MEDIUM confidence)

- [Croct Blog: Best React phone number input libraries 2026](https://blog.croct.com/post/best-react-phone-number-input-libraries) — ecosystem comparison
- [LogRocket: react-phone-number-input location detection](https://blog.logrocket.com/detecting-location-react-phone-number-input/)
- [Next.js hydration docs](https://nextjs.org/docs/app/getting-started/server-and-client-components) — SSR directives
- [shadcn-phone-input Vercel docs](https://shadcn-phone-input.vercel.app/#setup) — install prerequisites (confirmed via WebFetch)

### Tertiary (LOW confidence — 검증 필요)

- `react-intl-tel-input` deprecated 주장 — search 결과 기반, 별도 확인 없이 채택 (영향 없음: 3위 외 후보)
- bundlephobia 사이즈 (rate limit으로 수치 미확보 — 300KB/200KB 추정치는 npm API response에서 유추)

---

## Metadata

**Confidence breakdown:**
- Library comparison: **HIGH** — 3개 라이브러리 모두 Context7 공식 문서 + npm/GitHub API 교차 검증
- Integration sketch: **HIGH** — 기존 코드베이스 실제 파일 읽고 검증
- Pitfalls: **MEDIUM** — P1/P2/P6는 실제 빌드/테스트로만 확정 가능 (추정 포함)
- Recommendation: **HIGH** — 정량(스타/다운로드) + 정성(shadcn 호환/한국어 지원) 양측에서 1위 근거 일관

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30일 — stable ecosystem이므로 표준 유효기간)

**Next step for Planner:**
1. Plan에 shadcn add 3개 블록 (popover, command, scroll-area) 추가 태스크
2. `apps/web/components/ui/phone-input.tsx` 신규 태스크 (omeralpi 템플릿 포트 + Grapit 토큰)
3. `phone-verification.tsx` 교체 태스크 — UI-SPEC 10 contract 보존 확인
4. 테스트 수정 태스크 — 국가 감지 테스트 1-2개 재작성
5. E2E smoke — 한국 번호 + 미국 번호 + 중국 번호 3케이스 수동 smoke (000000 mock)
