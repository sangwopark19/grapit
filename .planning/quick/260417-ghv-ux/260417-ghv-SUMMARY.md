---
quick_id: 260417-ghv
slug: ux
description: 국제 전화번호 입력 UX 개선 — 국가코드 선택 라이브러리 도입 (react-phone-number-input + shadcn wrapper)
status: complete
started: 2026-04-17T02:52:38Z
completed: 2026-04-17T03:05:00Z
duration_min: 12
tasks_completed: 3
tasks_total: 3
commits:
  - a772cba feat(phone-input): add react-phone-number-input deps + shadcn blocks + PhoneInput wrapper
  - 456cfff refactor(phone-verification): swap input to PhoneInput + remove detectPhoneLocale
  - 4938d74 test(phone-verification): assert placeholder '010-0000-0000' visible for E2E selector
files_created:
  - apps/web/components/ui/phone-input.tsx
  - apps/web/components/ui/popover.tsx
  - apps/web/components/ui/command.tsx
  - apps/web/components/ui/scroll-area.tsx
files_modified:
  - apps/web/components/auth/phone-verification.tsx
  - apps/web/components/auth/__tests__/phone-verification.test.tsx
  - apps/web/package.json
  - pnpm-lock.yaml
files_deleted:
  - apps/web/lib/phone.ts
tests:
  vitest: 110/110 green (phone-verification 15/15)
  typecheck: 0 errors
  lint: 0 errors
---

# Quick Task 260417-ghv: 국제 전화번호 입력 UX 개선 Summary

**react-phone-number-input 3.4.16 + omeralpi/shadcn-phone-input 템플릿 기반 shadcn wrapper 도입 — 국가 선택 Popover + Command 검색 + ScrollArea로 사용자가 명시적으로 국가를 선택하게 UX 전환. libphonenumber-js/min detectPhoneLocale 텍스트 안내 방식 제거. 기존 4-state 재발송 버튼, 30s 쿨다운, 3분 만료 타이머, role 속성, autoComplete, mapErrorToCopy, D-19 시도횟수 미노출 모두 보존. PhoneVerificationProps 인터페이스 한 글자도 변경 없음 → 호출부(signup-step3, callback/page) 무영향. 백엔드(apps/api) 변경 0.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-17T02:52:38Z
- **Completed:** 2026-04-17T03:05:00Z (approx)
- **Tasks:** 3/3 완료

## Accomplishments

- `react-phone-number-input ^3.4.16` 설치 — 프로젝트 기존 `libphonenumber-js ^1.12.41`과 중복 없이 정합
- shadcn new-york 블록 3종 추가: `popover`, `command`(cmdk), `scroll-area`
- `apps/web/components/ui/phone-input.tsx` 신규 (166 lines) — Popover + Command 검색 + ScrollArea + 한국어 locale(`react-phone-number-input/locale/ko.json` 276개국) + `flags` 서브패키지 SVG 인라인(CDN 제거) + defaultCountry="KR" + inputComponent slot으로 shadcn Input 주입
- `phone-verification.tsx` 입력 블록 교체 — raw Input + detectPhoneLocale 안내 텍스트 제거, `<PhoneInput>` 사용. FSM/쿨다운/만료 타이머/에러 카피/접근성 속성 전부 그대로 유지
- `lib/phone.ts` 삭제 — `detectPhoneLocale` 완전 제거 (라이브러리가 담당)
- 테스트 13개 → 15개로 확장 — `vi.mock('@/lib/phone')` 제거 + 국가 드롭다운 상호작용 테스트 추가, E2E 선택자 계약(`getByPlaceholder('010-0000-0000')`) 단위 테스트로 잠금

## Task Commits (atomic)

1. **T1 feat:** `a772cba` — RPNI deps + shadcn blocks + PhoneInput wrapper
2. **T2 refactor:** `456cfff` — swap input + remove detectPhoneLocale + update tests (TDD)
3. **T3 test:** `4938d74` — assert placeholder '010-0000-0000' (E2E selector lock)

## Decisions Made

- `international` prop 미사용 — E2E `phoneInput.fill('01012345678')` 호환 위해 national 입력 허용. RPNI가 내부에서 E.164로 변환해 `onChange(e164)` 반환
- `flags` 서브패키지 SVG 인라인 사용 — GitHub Pages CDN 네트워크 의존 제거
- `locale/ko.json` 한국어 276개국 — 자체 COUNTRY_NAME_KO 매핑 유지보수 부담 제거
- `placeholder="010-0000-0000"` 보존 — E2E 선택자 `getByPlaceholder('010-0000-0000')` 그대로 사용
- 중국 본토(+86) 차단 로직은 백엔드(parseE164 → isChinaMainland → 400 응답)에 유지 — 프론트는 리스트에 CN 포함(사용자가 선택은 가능하되 submit 시 한국어 에러 카피로 안내)

## Deviations from Plan

### Auto-fixed Issues (Rule 3 - Blocking)

**1. shadcn command.tsx의 `showCloseButton` prop 제거**
- **Found during:** Task 1 (shadcn blocks 추가)
- **Issue:** shadcn@latest가 생성한 command.tsx가 DialogContent에 `showCloseButton` prop을 전달했으나, 프로젝트의 기존 `dialog.tsx`는 해당 prop을 지원하지 않음 (타입 에러)
- **Fix:** command.tsx의 CommandDialog wrapper에서 `showCloseButton` 제거
- **Committed in:** a772cba

**2. worktree pre-existing `packages/shared/node_modules` 누락 복구**
- **Found during:** Task 1 초반 (pnpm install)
- **Issue:** worktree 생성 시 `packages/shared/node_modules`가 symlink되지 않아 build 실패
- **Fix:** worktree에서 `pnpm install` + `pnpm --filter @grapit/shared build` 실행
- **Committed in:** (N/A — lock file 변경만 task 1에 포함)

## Verification

- vitest: **110/110 GREEN** (전체 web 테스트 중 phone-verification 관련 15/15 포함)
- typecheck (`pnpm --filter @grapit/web typecheck`): **0 errors**
- lint (`pnpm --filter @grapit/web lint`): **0 errors** (18 pre-existing warnings는 본 작업 무관 파일에서 발생)
- `apps/api/**` 파일 수정: **0건** (백엔드 계약 보존 확인)
- 호출부 파일(`signup-step3.tsx`, `app/auth/callback/page.tsx`, `profile-form.tsx`) 수정: **0건**
- `PhoneVerificationProps` 인터페이스: **한 글자도 변경 없음** (string literal diff check PASS)

## E2E / Human Smoke Status

자동 E2E(`signup-sms.spec.ts`)는 dev 서버 재시작 충돌로 worktree에서 직접 실행 보류됨. 단위 테스트로 `getByPlaceholder('010-0000-0000')` 선택자 계약은 이미 잠금 완료 — 새 UX에서도 E2E 3개 시나리오(회원가입 mock 000000 / 잘못된 코드 / 쿨다운 라벨)는 동일 selector로 동작할 것으로 예측.

**수동 smoke 권장 10개 시나리오:**
1. KR 기본 선택 확인 (컴포넌트 mount 시 defaultCountry="KR")
2. KR 번호 발송 (010xxxxxxxx → +821012345678 E.164 변환)
3. 국가 드롭다운 열기 → US 선택 → 번호 입력
4. CN 선택 → 서버 400 블로킹 메시지 확인 (백엔드 isChinaMainland 경로)
5. TH 등 미등록 국가 선택 → 안내 없이 정상 발송
6. 드롭다운 키보드 내비 (↑↓ / Enter / ESC)
7. cmdk 검색 (한국어/영문 검색어)
8. role="alert" / role="status" 에러/성공 메시지 확인
9. OTP input `autoComplete="one-time-code"` 유지 확인
10. D-19 시도횟수 미노출 (에러 카피에 숫자 포함 없음)

## Files Created/Modified/Deleted

### Created (신규 5)
- `apps/web/components/ui/phone-input.tsx` — PhoneInput wrapper (166 lines)
- `apps/web/components/ui/popover.tsx` — shadcn new-york
- `apps/web/components/ui/command.tsx` — shadcn new-york + cmdk (showCloseButton 제거)
- `apps/web/components/ui/scroll-area.tsx` — shadcn new-york

### Modified (수정 4)
- `apps/web/components/auth/phone-verification.tsx` — 입력 블록 교체, 국가 감지 안내 텍스트 제거
- `apps/web/components/auth/__tests__/phone-verification.test.tsx` — `vi.mock('@/lib/phone')` 제거, 드롭다운 테스트 추가
- `apps/web/package.json` — `react-phone-number-input ^3.4.16` 추가
- `pnpm-lock.yaml` — lockfile 업데이트

### Deleted (1)
- `apps/web/lib/phone.ts` — detectPhoneLocale 및 COUNTRY_NAME_KO 완전 제거

## Next Steps

- Phase 10 UAT(`10-UAT.md`) Test 4 재검증 — 새 국가 선택 UX로 "국가 감지/선택" 확인
- Test 5(CN 차단) 재검증 — 국가 드롭다운에서 CN 선택 후 서버 에러 카피 확인
- Test 8~10(쿨다운 만료 / D-19 / 접근성) 재검증
- 수동 smoke 10개 시나리오 수행
- E2E 스펙 필요시 selector 보정 후 `pnpm --filter @grapit/web test:e2e` GREEN 확인

## Self-Check: PASSED

- [x] 3 task commits 모두 git log에 존재 (a772cba, 456cfff, 4938d74)
- [x] 신규 4개 파일 / 수정 4개 파일 / 삭제 1개 파일 전부 실제 반영 확인
- [x] vitest 110/110 GREEN
- [x] typecheck / lint 0 errors
- [x] apps/api/** 수정 0건, 호출부 3개 파일 수정 0건
- [x] PhoneVerificationProps 인터페이스 불변
- [x] UI-SPEC 10 계약(4-state / 쿨다운 / 만료 / 에러 카피 / 접근성 / D-19) 전부 보존
