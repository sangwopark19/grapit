---
quick_id: 260420-fi4
date: 2026-04-20
status: complete
commit: ee910f3
file_changed: apps/web/components/auth/phone-verification.tsx
---

# Quick Task 260420-fi4 — SUMMARY

## Task
Phase 10 UI-REVIEW 수정 3건: phone-verification 버튼 variant, 타이포그래피 토큰, aria-live

## What Changed

Single file: `apps/web/components/auth/phone-verification.tsx` (+7 / -3, 3 hunks)

1. **L187 — Button variant** (send/resend)
   - Before: `variant={codeSent ? 'outline' : 'default'}`
   - After:  `variant={isSending ? 'default' : codeSent ? 'outline' : 'default'}`
   - UI-SPEC §Button Labels: sending 상태는 항상 `default` variant.

2. **L277 — Typography token**
   - Before: `<span className="text-sm text-success">`
   - After:  `<span className="text-caption text-success">`
   - 디자인 시스템 토큰 일관성(error/timer caption과 동일하게).

3. **L247-L254 — aria-live on timer container**
   - 조건부 `aria-live={timeLeft === 0 ? 'polite' : 'off'}` + `role={timeLeft === 0 ? 'status' : undefined}` 추가.
   - UI-SPEC §Accessibility Contract: "시간 만료" 전환을 스크린리더가 인지해야 함. 매초 tick 중에는 polite announcement 폭주를 피하기 위해 조건부로 처리.

## Verification

- `pnpm --filter @grapit/web typecheck` → PASS
- `pnpm --filter @grapit/web exec eslint components/auth/phone-verification.tsx` → PASS (0 new warnings)
- 4 grep done-criteria 모두 충족:
  - `variant={isSending ? 'default' : codeSent ? 'outline' : 'default'}` present
  - `text-caption text-success` present
  - `aria-live={timeLeft === 0 ? 'polite' : 'off'}` present
  - 기존 `text-sm text-success` 제거됨

## Commit

- `ee910f3` — `fix(quick-260420-fi4): UI-REVIEW 3건 정정 (phone-verification)`
- `0581c5a` — `chore: merge quick task worktree`

## Deviations

없음. Plan대로 실행. Plan 단계에서 파일 경로가 `apps/web/src/components/...`가 아니라 `apps/web/components/...` 임을 확인하여 정정.
