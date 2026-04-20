---
quick_task: 260417-ghv-ux
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/package.json
  - apps/web/components/ui/popover.tsx
  - apps/web/components/ui/command.tsx
  - apps/web/components/ui/scroll-area.tsx
  - apps/web/components/ui/phone-input.tsx
  - apps/web/components/auth/phone-verification.tsx
  - apps/web/components/auth/__tests__/phone-verification.test.tsx
  - apps/web/lib/phone.ts
autonomous: false
requirements:
  - UX-GHV-01  # 국가 선택 드롭다운 기반 국제 전화번호 입력
  - UX-GHV-02  # 기존 UI-SPEC 10 계약(4-state/쿨다운/role=alert/autoComplete/D-19) 보존
  - UX-GHV-03  # props 인터페이스(onVerified(code)) 및 백엔드 E.164 계약 무영향
must_haves:
  truths:
    - "사용자가 전화번호 입력 필드 좌측 국가 셀렉터를 열면 한국어로 국가명(276개)이 표시되고 검색할 수 있다"
    - "기본 선택은 대한민국(KR)이며 '01012345678' raw 입력 시 내부적으로 '+821012345678' E.164로 변환되어 POST /api/v1/sms/send-code 바디로 전송된다"
    - "국가를 미국(+1)/태국(+66) 등으로 변경하면 placeholder가 바뀌고 입력 값이 해당 국가 E.164 포맷으로 변환된다"
    - "'010-0000-0000' placeholder가 한국 기본 선택 상태에서 input 엘리먼트에 유지되어 E2E 선택자 getByPlaceholder('010-0000-0000')가 통과한다"
    - "4-state 재발송 버튼(initial/sending/cooldown/resend-ready), 30초 쿨다운, 3분 만료 타이머, role='alert', role='status', autoComplete='one-time-code', autoComplete='tel', D-19 시도 횟수 미노출 — 모두 회귀 없이 유지된다"
    - "중국 본토(+86) 선택 시 백엔드가 400 + '현재 중국 본토 SMS 인증은 지원되지 않습니다...' 메시지를 내려주고 프론트는 해당 메시지를 그대로 표시한다"
    - "기존 vitest 스위트(phone-verification.test.tsx)가 모두 green 상태로 통과한다"
    - "E2E signup-sms.spec.ts 3개 시나리오가 모두 통과한다 (한국 번호 + 000000 mock code 플로우)"
  artifacts:
    - path: "apps/web/components/ui/popover.tsx"
      provides: "shadcn Popover (@radix-ui/react-popover)"
      contains: "Popover"
    - path: "apps/web/components/ui/command.tsx"
      provides: "shadcn Command (cmdk)"
      contains: "CommandInput"
    - path: "apps/web/components/ui/scroll-area.tsx"
      provides: "shadcn ScrollArea (@radix-ui/react-scroll-area)"
      contains: "ScrollArea"
    - path: "apps/web/components/ui/phone-input.tsx"
      provides: "shadcn-style wrapper around react-phone-number-input with Korean labels + country-search dropdown"
      contains: "react-phone-number-input"
    - path: "apps/web/components/auth/phone-verification.tsx"
      provides: "UI-SPEC 10 contract preserved, input block replaced with <PhoneInput>"
      contains: "PhoneInput"
    - path: "apps/web/lib/phone.ts"
      provides: "축소된 E.164 유틸 (detectPhoneLocale 제거)"
      min_lines: 1
    - path: "apps/web/components/auth/__tests__/phone-verification.test.tsx"
      provides: "13개 테스트 중 국가 감지 1개 재작성 + vi.mock('@/lib/phone') 제거"
      contains: "PhoneVerification"
    - path: "apps/web/package.json"
      provides: "react-phone-number-input + cmdk + @radix-ui/react-popover + @radix-ui/react-scroll-area deps"
      contains: "react-phone-number-input"
  key_links:
    - from: "apps/web/components/ui/phone-input.tsx"
      to: "react-phone-number-input"
      via: "import * as RPNInput from 'react-phone-number-input'"
      pattern: "react-phone-number-input"
    - from: "apps/web/components/ui/phone-input.tsx"
      to: "apps/web/components/ui/popover.tsx + command.tsx + scroll-area.tsx + input.tsx"
      via: "Country selector UI composition"
      pattern: "@/components/ui/(popover|command|scroll-area|input)"
    - from: "apps/web/components/auth/phone-verification.tsx"
      to: "apps/web/components/ui/phone-input.tsx"
      via: "전화번호 입력 블록 교체 (Input → PhoneInput)"
      pattern: "PhoneInput"
    - from: "apps/web/components/auth/phone-verification.tsx"
      to: "POST /api/v1/sms/send-code"
      via: "apiClient.post with E.164 string from PhoneInput onChange"
      pattern: "sms/send-code"
---

<objective>
Phase 10.1 UAT Test 4 Gap — libphonenumber-js 자동 감지 텍스트 안내만으로는 국제 번호 입력 UX가 열악하다는 사용자 피드백을 해소한다. `react-phone-number-input` (1위 판정 23/25점) + shadcn new-york preset wrapper를 도입해 **명시적 국가 선택 드롭다운**(한국어 276개국) + **국가별 placeholder/자동 포맷팅**을 제공하고, 기존 UI-SPEC 10 계약(4-state 버튼 FSM, 30s 쿨다운, 3분 만료, role=alert/status, autoComplete, D-19)과 백엔드 E.164 계약(parseE164/isChinaMainland)을 **무영향**으로 유지한다.

Purpose: Phase 10.1 shipped 직후 드러난 국제번호 입력 UX 이슈를 Phase 12(UX 현대화) 착수 이전에 최소 범위로 해소. 신규 가입자가 국가를 드롭다운에서 선택하여 혼란 없이 SMS 인증을 진행할 수 있게 한다.

Output:
- 신규: `apps/web/components/ui/phone-input.tsx` (omeralpi 템플릿 기반 shadcn 포트, 한국어 locale)
- 신규(shadcn add): `popover.tsx`, `command.tsx`, `scroll-area.tsx`
- 수정: `apps/web/components/auth/phone-verification.tsx` (Input row만 교체, 타이머·버튼·에러 로직 전부 보존)
- 축소: `apps/web/lib/phone.ts` (detectPhoneLocale 제거)
- 재작성: 기존 13개 테스트 중 국가 감지 테스트 1-2개 + vi.mock('@/lib/phone') 제거
- 검증: vitest + playwright (signup-sms.spec.ts) 전부 green
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260417-ghv-ux/260417-ghv-RESEARCH.md
@.planning/phases/10-sms/10-UI-SPEC.md
@apps/web/components/auth/phone-verification.tsx
@apps/web/components/auth/signup-step3.tsx
@apps/web/lib/phone.ts
@apps/web/components/auth/__tests__/phone-verification.test.tsx
@apps/web/e2e/signup-sms.spec.ts
@apps/web/components.json
@apps/web/package.json

<interfaces>
<!-- 실행자가 건드리면 안 되는 기존 계약. 타사이트에서 호출되는 props / E2E 선택자 / 백엔드 바디 형식 -->

From apps/web/components/auth/phone-verification.tsx (props — 절대 변경 금지):
```typescript
interface PhoneVerificationProps {
  phone: string;              // state — E.164 문자열 또는 빈 문자열
  onPhoneChange: (phone: string) => void;
  onVerified: (code: string) => void;
  isVerified: boolean;
  error?: string;
}
```

From apps/web/components/auth/signup-step3.tsx (호출부 — 무영향):
```tsx
<PhoneVerification
  phone={phoneValue}
  onPhoneChange={(value) => form.setValue('phone', value, { shouldValidate: true })}
  onVerified={handlePhoneVerified}
  isVerified={isPhoneVerified}
  error={form.formState.errors.phone?.message}
/>
```

From apps/web/app/auth/callback/page.tsx — 동일 인터페이스로 호출됨. 변경 없음.

From apps/web/e2e/signup-sms.spec.ts (E2E 선택자 — 회귀 방지):
- `page.getByPlaceholder('010-0000-0000')` — 한국 기본 선택 상태에서 input 엘리먼트에 유지 필요
- `phoneInput.fill('01012345678')` — raw 11자리 입력이 내부적으로 +821012345678로 변환되어야 함
- `page.getByRole('button', { name: '인증번호 발송' })`
- `page.getByText(/재발송.*\d+s/)` — 4-state 버튼 FSM 유지
- `page.locator('text=/^0[0-3]:\\d{2}$/')` — 3분 만료 타이머 포맷 MM:SS
- `page.getByPlaceholder('인증번호 6자리')` — autoComplete=one-time-code
- `page.getByRole('button', { name: '확인' })`
- `page.getByText('인증 완료')` + `role="status"`

Backend contract (apps/api/src/modules/sms/phone.util.ts — 수정 금지):
```typescript
export function parseE164(input: string): ParsedPhone;  // E.164 passthrough
export function isChinaMainland(country: string | undefined): boolean; // country === 'CN'
```
요청 바디: `POST /api/v1/sms/send-code { phone: "+821012345678" }`

New wrapper export (신규 — 실행자가 생성):
```typescript
// apps/web/components/ui/phone-input.tsx
export interface PhoneInputProps extends Omit<React.ComponentProps<'input'>, 'onChange' | 'value' | 'ref'> {
  value: string;              // E.164 string or ""
  onChange: (value: string) => void;
}
export const PhoneInput: React.ForwardRefExoticComponent<PhoneInputProps & React.RefAttributes<HTMLInputElement>>;
```

Key library API (react-phone-number-input 3.4.16 — [VERIFIED: Context7 /catamphetamine/react-phone-number-input 2026-04-17]):
```typescript
import PhoneInput from 'react-phone-number-input';
import ko from 'react-phone-number-input/locale/ko.json';      // 276개국 한국어
import flags from 'react-phone-number-input/flags';             // SVG 인라인 (CDN 회피)
// onChange 시그니처: (value: E164Number | undefined) => void  ← "+821012345678" 또는 undefined
// 주요 props: defaultCountry="KR", labels={ko}, flagComponent, countrySelectComponent,
//           inputComponent, smartCaret={false}, international?
// "international" prop 없이 사용 → 국가별 national 포맷 입력, onChange는 E.164 반환 (원하는 동작)
```
</interfaces>
</context>

<tasks>

<!-- ========================================================================= -->
<!-- TASK 1: Scaffold dependencies + shadcn blocks + PhoneInput wrapper -->
<!-- ========================================================================= -->
<task type="auto">
  <name>Task 1: Add deps + shadcn blocks + create apps/web/components/ui/phone-input.tsx</name>
  <files>
    apps/web/package.json,
    apps/web/components/ui/popover.tsx,
    apps/web/components/ui/command.tsx,
    apps/web/components/ui/scroll-area.tsx,
    apps/web/components/ui/phone-input.tsx
  </files>
  <action>
**1.1 Install `react-phone-number-input`:**
```bash
pnpm --filter @grapit/web add react-phone-number-input
```
- 버전은 `^3.4.16` 이상이어야 함 ([VERIFIED: research §Environment Availability 2026-04-17]).
- `country-flag-icons`는 자동 transitive로 설치됨.
- 설치 후 `apps/web/package.json`에 `react-phone-number-input` 라인이 추가된 것 확인.

**1.2 Add shadcn blocks (3개):**
```bash
cd apps/web && pnpm dlx shadcn@latest add popover command scroll-area
```
- 설치 대상 파일이 이미 존재하면 덮어쓰기 프롬프트가 뜬다. 기존 파일이 있는 경우 생성하지 말고 건너뛸 것 (현재 `ls apps/web/components/ui/` 결과 세 파일 모두 없음).
- `shadcn add command`는 peer로 `cmdk`를 설치한다. research §P7 경고에 따라 `pnpm why cmdk`로 버전이 1.0.x인지 확인. 0.9.x라면 `pnpm --filter @grapit/web add cmdk@^1.0.0`로 올린다.
- `shadcn add popover`는 `@radix-ui/react-popover`를 설치한다.
- `shadcn add scroll-area`는 `@radix-ui/react-scroll-area`를 설치한다.
- 생성된 3파일은 shadcn new-york preset 표준 출력이므로 수정하지 말 것.

**1.3 Create `apps/web/components/ui/phone-input.tsx`:**
Research §Integration Sketch의 omeralpi/shadcn-phone-input 템플릿을 기반으로, Grapit 토큰(Input h-11 상속, border-gray-200, focus-visible:ring-primary)과 정합하는 wrapper를 작성한다.

파일 전체 구조:
```tsx
'use client';

import * as React from 'react';
import { CheckIcon, ChevronsUpDown } from 'lucide-react';
import type * as RPNInputType from 'react-phone-number-input';
import * as RPNInput from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import ko from 'react-phone-number-input/locale/ko.json';
import 'react-phone-number-input/style.css';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/cn';

type PhoneInputProps = Omit<
  React.ComponentProps<'input'>,
  'onChange' | 'value' | 'ref'
> & {
  value: string;
  onChange: (value: string) => void;
};

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, onChange, value, ...props }, ref) => (
    <RPNInput.default
      ref={ref as never}
      className={cn('flex', className)}
      labels={ko}
      defaultCountry="KR"
      flagComponent={FlagComponent}
      countrySelectComponent={CountrySelect}
      inputComponent={InputComponent}
      smartCaret={false}
      value={value || undefined}
      onChange={(v) => onChange(v ?? '')}
      {...props}
    />
  ),
);
PhoneInput.displayName = 'PhoneInput';

const InputComponent = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'>
>(({ className, ...props }, ref) => (
  <Input
    {...props}
    ref={ref}
    className={cn('rounded-e-lg rounded-s-none', className)}
  />
));
InputComponent.displayName = 'InputComponent';

type CountrySelectOption = {
  label: string;
  value: RPNInputType.Country;
};

type CountrySelectProps = {
  disabled?: boolean;
  value: RPNInputType.Country;
  onChange: (value: RPNInputType.Country) => void;
  options: CountrySelectOption[];
};

function CountrySelect({
  disabled,
  value,
  onChange,
  options,
}: CountrySelectProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('flex gap-1 rounded-e-none rounded-s-lg px-3 h-11')}
          disabled={disabled}
        >
          <FlagComponent country={value} countryName={value} />
          <ChevronsUpDown
            className={cn(
              '-mr-2 h-4 w-4 opacity-50',
              disabled ? 'hidden' : 'opacity-100',
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandList>
            <ScrollArea className="h-72">
              <CommandInput placeholder="국가 검색..." />
              <CommandEmpty>일치하는 국가가 없습니다.</CommandEmpty>
              <CommandGroup>
                {options
                  .filter((o) => o.value)
                  .map((option) => (
                    <CommandItem
                      className="gap-2"
                      key={option.value}
                      onSelect={() => onChange(option.value)}
                    >
                      <FlagComponent
                        country={option.value}
                        countryName={option.label}
                      />
                      <span className="flex-1 text-sm">{option.label}</span>
                      {option.value && (
                        <span className="text-sm text-gray-500">
                          {`+${RPNInput.getCountryCallingCode(option.value)}`}
                        </span>
                      )}
                      <CheckIcon
                        className={cn(
                          'ml-auto h-4 w-4',
                          option.value === value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FlagComponent({ country, countryName }: RPNInputType.FlagProps) {
  const Flag = flags[country];
  return (
    <span className="flex h-4 w-6 overflow-hidden rounded-sm bg-gray-100">
      {Flag && <Flag title={countryName} />}
    </span>
  );
}

export { PhoneInput };
```

**1.4 설계 노트 (집행자가 흔들리지 않게):**
- `international` prop은 **사용하지 않는다**. 이유: 한국 기본 선택 상태에서 사용자가 `01012345678` 같은 national 포맷을 입력해야 E2E 스펙(`phoneInput.fill('01012345678')`)이 통과한다. 라이브러리는 national 입력을 받아도 `onChange`에는 E.164(+821012345678)를 반환한다 ([VERIFIED: Context7 /catamphetamine/react-phone-number-input 2026-04-17]).
- `smartCaret={false}` 는 shadcn 레퍼런스 기본값. caret 점프 이슈 회피 (research §P1 완화책).
- `flags` 서브패키지 import → CDN(country-flag-icons) 네트워크 요청 제거 (research §P5 완화책).
- `locale/ko.json` 는 static JSON import. Next.js 16 Turbopack이 자동으로 단일 청크로 번들링 (추가 설정 불필요).
- `CountrySelect`의 트리거 `Button`에 `h-11` 명시 — 기존 `<Input>` (h-11)과 높이 일치 (UI-SPEC 10 §Interaction States "Input Row 레이아웃" 44px 터치 타겟 유지).
- `rounded-e-lg rounded-s-none` (input) + `rounded-s-lg rounded-e-none` (select button) = 두 엘리먼트가 하나의 rounded rect처럼 보임.
- `ref as never` 캐스팅은 `RPNInput.default`의 ref 타입이 HTMLInputElement와 완전히 일치하지 않아 추가한 escape hatch. strict 타입 원칙과 어긋나지만 라이브러리 타입 시그니처 한계로 불가피 — 대안으로 `RPNInput.default` 타입을 명시해도 됨. (Code style 위반 소지가 있어 집행자 재량으로 `as unknown as never` 또는 제네릭으로 변경 허용)

**1.5 주의사항:**
- `lucide-react`의 `CheckIcon`, `ChevronsUpDown`이 현재 버전(`^1.7.0`)에 존재하는지 확인. 없으면 `Check`, `ChevronDown`으로 대체.
- `@/lib/cn` 임포트가 프로젝트에 존재함 (signup-step3.tsx:8에서 이미 사용).
- `labels={ko}` 적용 시 `ko` JSON의 형태가 `{ KR: '대한민국', US: '미국', ... , ext: '내선', country: '국가', phone: '전화', ... }` 구조라는 점을 기억. 라이브러리가 키 매핑을 자동 수행.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web typecheck && pnpm --filter @grapit/web lint -- --max-warnings 0 apps/web/components/ui/phone-input.tsx apps/web/components/ui/popover.tsx apps/web/components/ui/command.tsx apps/web/components/ui/scroll-area.tsx</automated>
  </verify>
  <done>
- `apps/web/package.json`에 `react-phone-number-input` 추가됨
- `apps/web/components/ui/popover.tsx`, `command.tsx`, `scroll-area.tsx` 3파일 존재 (shadcn new-york)
- `apps/web/components/ui/phone-input.tsx`가 타입체크 + lint 통과
- `PhoneInput`이 default export가 아닌 named export로 제공됨
- `ko`, `flags`, `react-phone-number-input/style.css` 3개 import가 정상 해석됨
- 기존 파일(`phone-verification.tsx`, `lib/phone.ts`, 테스트 파일)은 **이 태스크에서 변경하지 않는다** — Task 2에서 수행
  </done>
</task>

<!-- ========================================================================= -->
<!-- TASK 2: Swap input + shrink lib/phone.ts + fix tests (TDD-style) -->
<!-- ========================================================================= -->
<task type="auto" tdd="true">
  <name>Task 2: Wire PhoneInput into phone-verification.tsx + shrink lib/phone.ts + fix tests (TDD)</name>
  <files>
    apps/web/components/auth/__tests__/phone-verification.test.tsx,
    apps/web/components/auth/phone-verification.tsx,
    apps/web/lib/phone.ts
  </files>
  <behavior>
테스트 먼저 작성/수정 (RED) → 구현 교체 (GREEN) 순으로 진행한다. 기존 테스트 13개의 기대 동작을 최대한 보존한다.

**수정할 테스트 (13개 중 1-3개):**

- **제거:** `vi.mock('@/lib/phone', ...)` 블록 전체 (라인 22-36). 새 UI는 `detectPhoneLocale`을 사용하지 않음.
- **재작성:** `describe('국가 감지')` 의 `it('+66 입력 시 "태국 번호로 SMS를 발송합니다" 텍스트 노출')` (라인 192-197).
  - 새 기대: "국가 감지 안내 텍스트는 더 이상 노출되지 않는다" — 드롭다운 트리거 버튼이 그 역할을 대체.
  - 교체 테스트 예시:
    ```typescript
    describe('국가 선택 드롭다운', () => {
      it('국가 셀렉터 버튼이 렌더링됨 (role=combobox 또는 button)', () => {
        render(<PhoneVerification {...defaultProps} phone="" />);
        // PhoneInput이 Popover Trigger 버튼을 포함 — getByRole('button', {name: ...}) 또는 국기 aria-label로 검색
        expect(screen.getAllByRole('button').length).toBeGreaterThan(1); // 기존 "발송" 버튼 + 국가 셀렉터
      });

      it('국가 감지 안내 텍스트("... 번호로 SMS를 발송합니다")는 더 이상 표시되지 않음', () => {
        render(<PhoneVerification {...defaultProps} phone="+66812345678" />);
        expect(screen.queryByText(/번호로 SMS를 발송합니다/)).not.toBeInTheDocument();
      });
    });
    ```
- **통과 유지 (나머지 10-11개):**
  - 발송 후 인증번호 6자리 인풋 노출
  - 30초 쿨다운 라벨
  - 쿨다운 종료 후 재발송 활성
  - 429/410/400 에러 카피
  - D-19 "남은 시도" 문구 부재
  - autoComplete="one-time-code"
  - aria-label "재발송 대기 중"
  - role="alert"
  → 모두 코드 인풋/버튼/에러 로직 관련이며 전화번호 input 블록 교체와 무관.

**주의:** `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`를 사용하는 테스트가 `react-phone-number-input`의 initial render를 정상 처리하는지 smoke 확인 필요. 만약 PhoneInput이 mount 시 비동기 상태 업데이트를 하면 `waitFor`로 감싸야 할 수 있음 (실행 시 관찰).

**defaultProps의 `phone: '01012345678'` 동작:** PhoneInput은 default 한국(KR) 상태에서 `value="01012345678"`가 오면 "이것은 E.164가 아닌 national 포맷"으로 해석되지 않는다 (`value` prop은 E.164를 기대). 기존 테스트는 `phone=""` 또는 `phone="+821012345678"`로 조정해야 통과할 가능성 높음 — 집행자가 실제 실행 시 관찰해서 조정.
  </behavior>
  <action>
**2.1 RED — 테스트 수정 (TDD 우선):**

1. `apps/web/components/auth/__tests__/phone-verification.test.tsx` 열기.
2. 라인 22-36의 `vi.mock('@/lib/phone', ...)` 블록 **전체 제거**.
3. 라인 192-197의 국가 감지 테스트를 `behavior` 섹션의 2개 신규 테스트로 교체.
4. `defaultProps.phone`을 `'01012345678'` → `''`로 변경 (PhoneInput이 value를 E.164로 기대하므로 빈 문자열이 더 안전). 기존 `handleSendCode`의 버튼 활성 조건이 `phone.length >= 10`이므로 일부 테스트에서 `user.type` 또는 `onPhoneChange` mock 호출로 번호를 채워야 할 수 있다 — 실행자 판단.
   - **대안:** `defaultProps.phone='+821012345678'` (E.164)로 유지 → PhoneInput이 이를 한국 번호로 인식하여 display — 이 경우 기존 "인증번호 발송" 버튼 활성 조건을 만족시키기 가장 쉬운 경로.
5. `pnpm --filter @grapit/web test phone-verification` 실행. 13개 중 국가감지 1개는 **FAIL 예상** (ok — RED 단계).
6. 국가감지 관련 2개 신규 테스트도 **현재 구현이 `detectPhoneLocale`을 아직 호출 중이라 FAIL** (ok — RED 단계).

**2.2 GREEN — `apps/web/components/auth/phone-verification.tsx` 입력 블록 교체:**

1. import 변경:
   - **제거:** `import { detectPhoneLocale } from '@/lib/phone';`
   - **추가:** `import { PhoneInput } from '@/components/ui/phone-input';`
2. 컴포넌트 내부에서 `locale = detectPhoneLocale(phone)`, `showCountryHint`, `formatPhoneInput`, `handlePhoneInput`, `displayPhone`, `isInternational` 관련 블록 **전부 제거**.
3. `sendButtonDisabled` 계산 단순화:
   ```typescript
   const sendButtonDisabled =
     isVerified ||
     isSending ||
     (codeSent && resendCooldown > 0) ||
     (!codeSent && phone.length < 5); // E.164는 최소 +X 3+ 자리 — 라이브러리가 검증 책임. 단순 length 가드로 대체.
   ```
   (또는 `react-phone-number-input`의 `isValidPhoneNumber(phone)` import하여 더 엄격한 검증 — **권장**)
   ```typescript
   import { isValidPhoneNumber } from 'react-phone-number-input';
   const sendButtonDisabled =
     isVerified ||
     isSending ||
     (codeSent && resendCooldown > 0) ||
     (!codeSent && !isValidPhoneNumber(phone));
   ```
4. JSX 교체 (라인 210-243 → 하기 블록):
   ```tsx
   {/* Phone input + send button */}
   <div className="flex gap-2">
     <PhoneInput
       value={phone}
       onChange={onPhoneChange}
       placeholder="010-0000-0000"  // 한국 기본 상태에서 이 placeholder가 inner <Input>에 전달됨
       autoComplete="tel"
       disabled={isVerified}
       className="flex-1"
     />
     <Button
       type="button"
       variant={codeSent ? 'outline' : 'default'}
       size="lg"
       onClick={handleSendCode}
       disabled={sendButtonDisabled}
       aria-label={sendButtonAriaLabel}
       className="shrink-0"
     >
       {isSending ? (
         <>
           <Loader2 className="h-4 w-4 animate-spin" />
           발송 중...
         </>
       ) : codeSent && resendCooldown > 0 ? (
         `재발송 (${resendCooldown}s)`
       ) : codeSent ? (
         '재발송'
       ) : (
         '인증번호 발송'
       )}
     </Button>
   </div>
   ```
5. "국가 감지 안내" 블록(`{showCountryHint && ...}` 부분, 라인 245-250) **전부 제거** (드롭다운이 대체).
6. 나머지 UI 로직(코드 input, 타이머, role=alert 에러, CheckCircle2 성공, role=status) **전부 유지** — 한 줄도 수정하지 말 것.

**2.3 GREEN — `apps/web/lib/phone.ts` 축소:**

현재 내용을 **완전 삭제**하고 다음으로 교체:
```typescript
// 전화번호 감지/포맷팅 로직은 `apps/web/components/ui/phone-input.tsx` (react-phone-number-input wrapper)로 이관됨.
// 국가명 한국어 매핑은 `react-phone-number-input/locale/ko.json` 사용.
// 이 파일은 호환성을 위해 빈 export로 남겨둔다. 다음 리팩터에서 삭제 가능.
export {};
```

**대안 (권장):** 파일을 **완전 삭제**. 단, 다른 곳에서 import하는 것이 없는지 확인 필수:
```bash
grep -rn "from '@/lib/phone'" apps/web/ --include="*.tsx" --include="*.ts"
```
- `phone-verification.tsx`(Task 2.2에서 제거 완료) 외에 남아있으면 제거 후 삭제.
- `phone-verification.test.tsx`(Task 2.1에서 mock 제거 완료)에도 import가 남아있으면 안 됨.
- 남아있는 곳 없으면 `rm apps/web/lib/phone.ts`.

**2.4 GREEN — 테스트 재실행:**

```bash
pnpm --filter @grapit/web test phone-verification
```
- 기대: 전체 green (수정한 테스트 포함 13~14개).
- 실패 시 흔한 원인:
  - PhoneInput이 초기 render에서 `onChange(undefined)` 호출 → `onPhoneChange('')` 호출됨 → defaultProps의 `onPhoneChange` mock이 초기에 호출된 기록이 남음. 이는 문제 없음 (기존 테스트가 호출 횟수를 검사하지 않음).
  - `getByPlaceholder('인증번호 6자리')`는 코드 인풋이라 영향 없음.
  - `getByRole('button', { name: /인증번호 발송/ })`가 **국가 셀렉터 버튼도 하나 더 있어서** 매칭 되는데 — 국가 셀렉터 버튼의 accessible name은 국기 SVG `title`(예: "한국") 또는 Chevron 아이콘일 뿐이므로 "인증번호 발송" 정규식과 충돌하지 않음. 충돌 시 `getAllByRole` + 필터.

**2.5 Lint/typecheck:**

```bash
pnpm --filter @grapit/web typecheck
pnpm --filter @grapit/web lint
```
Code style CLAUDE.md: strict 타입, no any, ES modules — `phone-verification.tsx`의 모든 타입이 유지되어야 함.

**2.6 주의사항 (E2E 선택자 보호):**

- `phoneInput.fill('01012345678')` in signup-sms.spec.ts에서 E2E 통과 여부는 **Task 3에서 검증**. 이 태스크에서는 vitest 녹색만 달성.
- `page.getByPlaceholder('010-0000-0000')`는 한국 기본 선택 상태의 inner `<Input>`에 `placeholder` prop이 spread되어야 통과. PhoneInput wrapper의 `{...props}` spread가 `inputComponent`에 placeholder를 전달하는지 confirm — 라이브러리 API는 `placeholder`를 inner input으로 전달함 ([VERIFIED: research §Open Questions #3 → confirmed in Context7 snippet "Input Component - Default Country" 예제에 `placeholder` prop 사용]).
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web test -- phone-verification && pnpm --filter @grapit/web typecheck && pnpm --filter @grapit/web lint</automated>
  </verify>
  <done>
- `apps/web/components/auth/phone-verification.tsx`의 전화번호 input row가 `<PhoneInput>`으로 교체됨
- `detectPhoneLocale` import와 사용 모두 제거됨
- "국가 감지 안내" 보조 텍스트 블록 제거됨
- 4-state 재발송 버튼 / 30s 쿨다운 / 3분 만료 / role=alert / role=status / autoComplete="one-time-code" / D-19 — 전부 회귀 없이 유지
- `apps/web/lib/phone.ts` 축소 또는 삭제
- `apps/web/components/auth/__tests__/phone-verification.test.tsx` — `vi.mock('@/lib/phone')` 제거 + 국가 감지 테스트 재작성 + 모든 테스트 green
- `pnpm --filter @grapit/web test` 전체 green
- `pnpm --filter @grapit/web typecheck` green
- `pnpm --filter @grapit/web lint` green
- `PhoneVerificationProps` 인터페이스 **한 글자도 변경되지 않음**
  </done>
</task>

<!-- ========================================================================= -->
<!-- TASK 3: E2E + human smoke verification -->
<!-- ========================================================================= -->
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Task 1에서 `react-phone-number-input` 기반 `<PhoneInput>` wrapper + 3개 shadcn blocks를 추가하고, Task 2에서 `phone-verification.tsx` 전화번호 입력 블록을 새 컴포넌트로 교체했다. 기존 UI-SPEC 10 계약(4-state 버튼, 타이머, 접근성, D-19)과 백엔드 E.164 계약을 보존한 상태로 국가 드롭다운(한국어 276개국) UX가 활성화됐다.
  </what-built>
  <how-to-verify>
**1. E2E 테스트 자동 실행 (집행자가 먼저 실행):**
```bash
cd /Users/sangwopark19/icons/grapit
# API + web 서버 실행 필요 (INFOBIP_API_KEY 미설정 = dev mock)
# 터미널 A:
pnpm --filter @grapit/api dev
# 터미널 B:
pnpm --filter @grapit/web dev
# 터미널 C:
pnpm --filter @grapit/web test:e2e -- signup-sms
```
- 기대: 3개 시나리오 모두 green (한국 번호 `000000` flow / 잘못된 코드 에러 / 30s 쿨다운 라벨)
- 만약 `getByPlaceholder('010-0000-0000')` 선택자가 실패하면 (inner input에 placeholder 미전달), PhoneInput wrapper의 `{...props}` spread가 inputComponent로 전달되는지 확인하고 필요 시 `inputComponent`에 명시적으로 `placeholder` prop 전달.

**2. 사용자 수동 smoke 테스트 (개발 서버 3000+8080):**
`http://localhost:3000/auth` → 회원가입 탭 → step1/2 통과 → step3 도달 후 전화번호 필드에서:

| 시나리오 | 액션 | 기대 |
|---|---|---|
| KR 기본 | 페이지 로드 | 국가 셀렉터에 한국 국기 + placeholder `010-0000-0000` 표시 |
| KR 입력 | `01012345678` 타이핑 | 인풋이 자동 포맷 (`010 1234 5678` 또는 `010-1234-5678`), "인증번호 발송" 활성 |
| KR 발송 | 버튼 클릭 | 쿨다운 `재발송 (30s)` 등장, 인증번호 인풋 노출, 000000 입력 → 확인 → "인증 완료" |
| US 선택 | 드롭다운 열기 → "미국" 검색 → 선택 | 국기 변경, placeholder가 `(201) 555-0123` 같은 US 샘플로 변경 |
| US 입력 | `2025550123` 입력 | E.164 +12025550123으로 변환됨 (React DevTools로 `phone` state 확인) |
| CN 블로킹 | 드롭다운에서 "중국" 선택 + `13812345678` 입력 → 발송 | 서버 400 응답 → "현재 중국 본토 SMS 인증은 지원되지 않습니다..." 표시 |
| TH 표시 | "태국" 선택 + `812345678` 입력 | 국기/placeholder 변경, 드롭다운 바로 아래 "태국 번호로 SMS를 발송합니다" 같은 보조 텍스트 **노출 안 됨** (드롭다운이 대체) |
| 드롭다운 a11y | Tab 이동 | 셀렉터 버튼 → Input → 발송 버튼 순서 유지, Enter로 Popover 열림, ESC로 닫힘 |
| 접근성 | DevTools Accessibility 패널 | 에러 시 role="alert" 존재, 인증 완료 시 role="status" 존재, 쿨다운 버튼 aria-label="재발송 대기 중..." 존재 |
| D-19 | 3회 잘못된 코드 연속 입력 | "남은 시도 N회" 같은 문구 절대 노출되지 않음 |

**3. 번들 사이즈 스모크 (선택):**
```bash
pnpm --filter @grapit/web build
# 빌드 결과에서 /auth 라우트의 First Load JS 증가분이 합리적인지 확인 (+50kb 이내 예상)
```

**4. 승인 기준:**
- [ ] E2E 3개 시나리오 green
- [ ] 수동 smoke 10개 케이스 모두 기대 동작
- [ ] React 19 strict mode에서 hydration 경고 없음 (DevTools Console 확인)
- [ ] 기존 PhoneVerificationProps 시그니처 변경 없음 (`signup-step3.tsx`, `callback/page.tsx` 컴파일 green)
  </how-to-verify>
  <resume-signal>
"approved" 또는 발견한 이슈 설명 (예: "placeholder가 inner input에 전달 안 됨", "KR 드롭다운 검색 필터가 영어로만 동작", "CN 선택 시 400 응답이 안 옴"). 발견 시 Task 2로 되돌아가 수정 후 재검증.
  </resume-signal>
</task>

</tasks>

<verification>
## Phase-level Sanity Checks

**1. 코드 무결성:**
```bash
pnpm --filter @grapit/web typecheck && pnpm --filter @grapit/web lint
pnpm --filter @grapit/web test
pnpm --filter @grapit/web test:e2e -- signup-sms
```

**2. 호출부 회귀 방지:**
- `apps/web/components/auth/signup-step3.tsx` — PhoneVerification props 인터페이스(`phone`, `onPhoneChange`, `onVerified`, `isVerified`, `error`) 미변경 확인
- `apps/web/app/auth/callback/page.tsx` — 동일

**3. 백엔드 무영향:**
- `apps/api/**` 파일 diff 없음 (git status 확인)
- `POST /api/v1/sms/send-code`가 `+821012345678` E.164를 그대로 수신 → `parseE164` passthrough 정상 동작

**4. UI-SPEC 10 계약:**
- 4-state 버튼 FSM (initial/sending/cooldown/resend-ready)
- 30s 쿨다운 타이머 + `재발송 (Ns)` 라벨
- 3분 만료 타이머 + MM:SS 포맷
- `role="alert"` (에러), `role="status"` (성공)
- `autoComplete="one-time-code"` (code input), `autoComplete="tel"` (phone input)
- D-19 시도 횟수 미노출
- `mapErrorToCopy` 분기 (429/410/422/400 중국본토/400 일반/5xx)

**5. 접근성:**
- 쿨다운 버튼 `aria-label="재발송 대기 중, N초 남음"` 유지
- `getByRole('button', { name: /인증번호 발송/ })` E2E 선택자 통과
</verification>

<success_criteria>
- [ ] 국가 드롭다운 UI가 한국어로 276개국 표시하고 검색 가능
- [ ] 기본 선택: 대한민국(KR), placeholder `010-0000-0000` 유지
- [ ] KR/US/TH 기준 E.164 변환이 올바르게 `onChange`로 전달됨
- [ ] CN 선택 시 백엔드 400 + 한국어 에러 메시지 표시 유지 (프론트 변경 없음)
- [ ] `pnpm --filter @grapit/web test` 전체 green
- [ ] `pnpm --filter @grapit/web test:e2e -- signup-sms` 3개 시나리오 green
- [ ] `pnpm --filter @grapit/web typecheck && lint` green
- [ ] `signup-step3.tsx` / `callback/page.tsx` / `apps/api/**` 수정 없음
- [ ] `PhoneVerificationProps` 인터페이스 한 글자도 변경 없음
- [ ] 사용자 수동 smoke 10개 시나리오 모두 통과
</success_criteria>

<output>
After all three tasks complete + human smoke approval, create:
`.planning/quick/260417-ghv-ux/260417-ghv-SUMMARY.md`

summary.md 포맷에 따라 작성하되 다음 필드 포함:
- `provides`: ["shadcn PhoneInput wrapper", "국가 선택 드롭다운 UX", "shadcn popover/command/scroll-area blocks"]
- `affects`: ["apps/web/components/auth/phone-verification.tsx", "apps/web/lib/phone.ts (축소)", "apps/web/package.json (+react-phone-number-input)"]
- `patterns`: ["react-phone-number-input + shadcn wrapper 하이브리드", "omeralpi 템플릿 포트 방식"]
- `tech_stack`: ["react-phone-number-input", "cmdk (shadcn Command)"]
- `decisions`: ["international prop 미사용 (E2E 선택자 호환성 우선)", "flags 서브패키지 사용 (CDN 회피)", "isValidPhoneNumber로 버튼 활성 조건 단순화", "lib/phone.ts 삭제 (또는 빈 export)"]

Git commits (3개, atomic, conventional commits — CLAUDE.md 규약):
1. `feat(phone-input): add react-phone-number-input deps + shadcn blocks + PhoneInput wrapper`
2. `refactor(phone-verification): swap input block with PhoneInput + remove detectPhoneLocale + update tests`
3. `test(phone-verification): E2E + smoke verified` (빈 커밋 또는 SUMMARY.md 커밋 — 선택)

**주의:** Co-Authored-By trailer 절대 추가 금지 (CLAUDE.md 글로벌 규약).
</output>
