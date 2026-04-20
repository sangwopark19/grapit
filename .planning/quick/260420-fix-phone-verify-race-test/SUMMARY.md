---
slug: fix-phone-verify-race-test
date: 2026-04-20
status: complete
pr: 16
commit: 3e08d8f
---

# SUMMARY: phone-verification 쿨다운 종료 테스트 race condition 수정

## 문제

PR #16 CI 100% 실패. `phone-verification.test.tsx > 쿨다운 종료 > "재발송" 버튼이 활성화` 한 케이스만 실패. 로컬은 통과했으나 CI(GitHub Actions runner) 환경에서 일관되게 실패.

## 근본원인

테스트의 timer race condition:

```js
await user.click(screen.getByRole('button', { name: /인증번호 발송/ }));
vi.advanceTimersByTime(30_000);  // ← setResendCooldown(30) commit 전에 실행됨
await waitFor(() => expect(btn).not.toBeDisabled());
```

- `await user.click()`은 click event dispatch까지만 await
- handleSendCode 내 `await apiClient.post()` 마이크로태스크가 완료되기 전 `vi.advanceTimersByTime(30_000)` 호출
- 그 시점에 `setResendCooldown(30)`이 commit되지 않았고 `setInterval`도 생성되지 않음
- `advanceTimersByTime`이 advance할 timer가 없어 무의미해짐
- waitFor 폴링 중에는 추가 advance 없어 카운트다운이 진행되지 않음
- 로컬은 CPU가 빨라 우연히 마이크로태스크가 advance 전에 처리되어 통과

## 해결

`apps/web/components/auth/__tests__/phone-verification.test.tsx`:

1. `act` import 추가
2. `vi.advanceTimersByTime` 호출 전, 쿨다운 UI(`재발송 (30s)`) 렌더 대기
3. `vi.advanceTimersByTime`을 `act(async () => ...)` 으로 래핑

## 검증

- 로컬: `pnpm --filter @grapit/web test --run` → 110/110 passed
- CI: PR #16 새 run 24643634374 → **PASS** (2m43s)

## 변경 파일

- `apps/web/components/auth/__tests__/phone-verification.test.tsx` (+10/-2)
- `.planning/quick/260420-fix-phone-verify-race-test/PLAN.md` (new)

## 커밋

- `3e08d8f` fix(test): phone-verification 쿨다운 종료 테스트 race condition 해결
