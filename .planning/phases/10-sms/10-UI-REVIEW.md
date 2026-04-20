---
phase: 10
slug: sms
audited: 2026-04-20
auditor: gsd-ui-auditor
baseline: 10-UI-SPEC.md
screenshots: captured (localhost:3000)
---

# Phase 10 — UI Review

**Audited:** 2026-04-20
**Baseline:** 10-UI-SPEC.md (approved design contract)
**Screenshots:** captured at localhost:3000/auth (dev server active)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 에러 카피 5종 전부 계약 일치. placeholder 단축 (`010-0000-0000`)과 국가 감지 안내 블록 미구현(Discretion 항목) |
| 2. Visuals | 3/4 | 4-state 버튼 시각 계층 명확. PhoneInput 국가선택 dropzone UI가 계약 범위 외 추가된 점은 scope 내. `인증 완료` 텍스트가 `text-sm`으로 타이머/에러 `text-caption`과 불일치 |
| 3. Color | 4/4 | accent 사용처 계약 준수. 하드코딩 색상 없음. destructive/success/gray-500 토큰 정확히 분기 |
| 4. Typography | 3/4 | `인증 완료` span이 `text-sm`(계약: `text-caption`) 사용 — 1곳 미교정. 에러·타이머는 `text-caption` 정확 |
| 5. Spacing | 4/4 | `space-y-4`(16px) 교정 완료. `gap-2`(8px) 일관 사용. 비표준 arbitrary 값 없음 |
| 6. Experience Design | 3/4 | 5개 상태 완전 처리. `aria-live` 만료 타이머에 미부재 — 시간 만료 전환 시 스크린리더 미통보. 재발송 중(codeSent=true+isSending=true) 버튼이 outline variant로 렌더링 (계약: sending=default) |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **재발송 sending 상태 버튼 variant 오류** — 재발송 API 호출 중 버튼이 `outline`으로 렌더링되어 "발송 중" 강조가 약함. 계약(UI-SPEC §Button Labels)은 sending 상태 항상 `default` — `variant={isSending ? 'default' : codeSent ? 'outline' : 'default'}` 로 교정.

2. **`인증 완료` 텍스트 토큰 미교정** — `phone-verification.tsx:273` `<span className="text-sm text-success">인증 완료</span>` 에서 `text-sm`이 `text-caption`으로 교정되지 않음. 에러 메시지·타이머와 동일 토큰으로 통일하면 14px 일관성 확보. 변경: `text-caption text-success`.

3. **만료 타이머 `aria-live` 미구현** — `phone-verification.tsx:247-255` 타이머 `<div>` 에 `aria-live` 속성 없음. UI-SPEC §Accessibility Contract: "시간 만료" 상태 진입 시에만 `aria-live="polite"` 통보 필요. 현재 스크린리더는 타이머 카운트다운 및 만료 전환을 전혀 인지하지 못함. 조건부 `aria-live` 또는 숨김 `role="status"` 요소로 "시간 만료" 알림 추가.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**계약 준수 항목:**
- 에러 카피 5종 전부 UI-SPEC §에러 메시지 카피 계약과 정확 일치
  - `429` → `"잠시 후 다시 시도해주세요"` (line 25)
  - `410/422` → `"인증번호가 만료되었습니다. 재발송해주세요"` (line 27)
  - `400 일반` → `"인증번호가 일치하지 않습니다"` (line 30)
  - `400 중국 본토` → 서버 메시지 전달 (line 29)
  - `5xx` → `"일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."` (line 33)
- 버튼 라벨 4-state 계약 완전 준수
  - `initial`: "인증번호 발송" (line 204)
  - `sending`: "발송 중..." + Loader2 (line 197)
  - `cooldown`: "재발송 (Ns)" 동적 초 단위 `s` (line 200)
  - `resend-ready`: "재발송" (line 202)
- 인증번호 확인 버튼: "확인" / Loader2 (line 242)
- 시간 만료 문구: "시간 만료" (line 253) — 계약 일치
- 인증 완료 문구: "인증 완료" (line 273) — 계약 일치
- 금지 문구 없음: "OTP", "PIN", "Infobip", "Twilio", "카카오알림톡" 전무
- 시도 횟수 미노출 (D-19) 준수

**미흡 항목:**
- `phone-verification.tsx:180` placeholder: `"010-0000-0000"` — UI-SPEC §인풋 Placeholder 계약은 `"010-0000-0000 또는 국가코드 포함 +66..."`. 현재 구현이 단축형임. PhoneInput 컴포넌트가 국가 선택 드롭다운을 포함하는 더 완성된 형태로 대체되어 있어 placeholder 중요도가 낮아진 맥락이나, 계약과는 상이
- 국가 감지 안내 문구 블록 미구현 (`"태국 번호로 SMS를 발송합니다"` 등) — UI-SPEC에서 "Discretion — 없어도 무방"으로 명시된 선택 항목. 미구현이 계약 위반은 아니나 점수에 반영

### Pillar 2: Visuals (3/4)

**계약 준수 항목:**
- 4-state 버튼 시각 계층 명확: initial(default/primary), cooldown(outline/disabled), resend-ready(outline/enabled) 시각적 차이 분명
- Loader2 `h-4 w-4 animate-spin` 정확 사용 (line 196, 240)
- CheckCircle2 `h-5 w-5 text-success` 정확 (line 272) — 계약 §성공 상태 완전 일치
- PhoneInput 컴포넌트가 국기 플래그 + 국가 선택 드롭다운을 포함 — UI-SPEC §Out of Scope "전화번호 입력 중 실시간 국기 아이콘 표시"가 이미 구현된 상태이나 이는 더 완성된 형태로 scope 이탈이 아님
- 코드 입력 row, 타이머 row, 에러 row 레이아웃 계층 준수

**미흡 항목:**
- `인증 완료` 텍스트(`text-sm`)가 에러 메시지/타이머(`text-caption`)와 토큰 불일치로 시각적 크기 차이 발생 (실질적으로 동일한 14px이지만 토큰 체계 불일치)
- 재발송 중(sending) 버튼이 outline variant를 적용하여 CTA 강조 약화 — 스크린 좌측 코드 분기에서 `isSending=true && codeSent=true` 조합 시 발생

### Pillar 3: Color (4/4)

계약 완전 준수. 이슈 없음.

- accent(`text-primary`, `bg-primary`) 사용처: `signup-step3.tsx:116` 성별 선택 버튼 활성 상태만. 계약 허용 범위
- 에러 상태 전부 `text-error` 토큰 사용 (line 211, 249, 253, 263)
- 성공 상태 `text-success` 토큰 사용 (line 272, 273)
- 하드코딩 색상값(`#HEX`, `rgb(`) 없음
- shadcn Button default variant가 `--color-primary` 배경 사용 — 계약 일치
- 쿨다운 중 재발송 버튼 outline variant로 accent 사용 안 함 — 계약 준수

### Pillar 4: Typography (3/4)

**계약 준수 항목:**
- 에러 메시지: `text-caption` (line 211, 263) — 14px 정확
- 만료 타이머: `text-caption` (line 249, 253) — UI-SPEC §Timer Display 일치 (`text-sm` → `text-caption` 교정 완료)
- 인풋 텍스트: shadcn Input 기본 `text-base` (16px) — 계약 일치
- 버튼 라벨: shadcn 기본 `font-medium` (500) — 계약에서 "계승 값"으로 허용

**미흡 항목:**
- `phone-verification.tsx:273` `<span className="text-sm text-success">인증 완료</span>` — `text-sm`(14px)은 `text-caption`(14px)과 픽셀값은 같으나 UI-SPEC §Copywriting §성공 상태 카피에서 토큰 명시 없고, UI-SPEC §Typography에서 Caption 역할은 `text-caption`으로 통일 요구. 에러 메시지(`text-caption`)와 동일 계층이므로 토큰 통일 필요
- 실제 픽셀 렌더 영향은 없으나 토큰 일관성 위반으로 감점

### Pillar 5: Spacing (4/4)

계약 완전 준수. 이슈 없음.

- 루트 div: `space-y-4` (16px) — UI-SPEC §Implementation Notes `space-y-3` → `space-y-4` 교정 완료 (line 174)
- 인풋-버튼 gap: `gap-2` (8px) — 계약 `sm` 토큰 일치 (line 176, 217, 247)
- 코드 입력 서브 블록: `space-y-2` (8px) — 계약 내부 블록 간격 준수 (line 216)
- arbitrary spacing 값(`[Npx]`, `[Nrem]`) 없음 — 전체 파일 검증 완료
- 8-point grid 위반 없음

### Pillar 6: Experience Design (3/4)

**계약 준수 항목:**
- 5개 전체 상태 처리 완료: idle → sending → code-input → verifying → verified
- expired 상태: 인증번호 input disabled, 재발송 버튼 활성 (line 229)
- 로딩 스피너: 발송 중(`isSending`, line 194), 검증 중(`isVerifying`, line 239) 양쪽 구현
- 에러 표시: `role="alert"` + `animate-in fade-in duration-150` (line 262-263)
- 인증 완료: `role="status"` wrapper (line 271)
- 쿨다운 aria-label: `"재발송 대기 중, N초 남음"` (line 170) — 스크린리더 지원
- `autoComplete="one-time-code"` (line 221) — iOS/Android SMS 자동입력 트리거
- `autoComplete="tel"` (line 181) — 계약 추가 속성 준수
- `inputMode="numeric"` (line 220) — 모바일 숫자 키보드
- 독립 2개 타이머 (`timerRef`, `cooldownTimerRef`) 정확 구현
- 발송/재발송 시 두 타이머 동시 재시작 구현 확인 (line 120-121)

**미흡 항목:**

1. **만료 타이머 `aria-live` 미구현** (`phone-verification.tsx:247-255`)
   - UI-SPEC §Accessibility Contract: 타이머 `<span>`에 `aria-live` 요구 (1초 갱신은 off, "시간 만료" 진입 시 polite)
   - 현재 `<div className="flex items-center gap-2">` 블록에 `aria-live` 속성 없음
   - 스크린리더 사용자가 타이머 만료를 인지할 수 없음

2. **재발송 sending 상태 variant 불일치** (`phone-verification.tsx:187`)
   - `variant={codeSent ? 'outline' : 'default'}` — `isSending` 분기 없음
   - 재발송 클릭 시 (`codeSent=true`, `isSending=true`) → outline variant 렌더링
   - UI-SPEC §Button Labels: sending 상태는 항상 `default` variant
   - 초기 발송(codeSent=false) 시는 영향 없음, 재발송 시만 발생

---

## Registry Safety

Registry audit: 0 third-party blocks — shadcn official only (button, input). Safety gate not required.

---

## Files Audited

- `apps/web/components/auth/phone-verification.tsx` — 주요 감사 대상 (278 lines)
- `apps/web/components/auth/signup-step3.tsx` — 호출부 인터페이스 확인 (276 lines)
- `apps/web/components/ui/phone-input.tsx` — PhoneInput 컴포넌트 구조 확인 (166 lines)
- `apps/web/app/globals.css` — 색상/타이포그래피/스페이싱 토큰 기준값 (120 lines)
- `packages/shared/src/constants/index.ts` — SMS 공유 상수 확인
- `apps/web/components.json` — shadcn 설정 (new-york preset 확인)
- `.planning/phases/10-sms/10-UI-SPEC.md` — 감사 기준 계약서
- `.planning/phases/10-sms/10-08-SUMMARY.md` — 구현 내역 확인
- 스크린샷: `localhost:3000/auth` desktop(1440x900) + mobile(375x812)
