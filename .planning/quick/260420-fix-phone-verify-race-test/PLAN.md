---
slug: fix-phone-verify-race-test
date: 2026-04-20
status: in-progress
---

# Fix CI: phone-verification 쿨다운 종료 테스트 race condition

## 증상

PR #16 CI 100% 실패. `apps/web/components/auth/__tests__/phone-verification.test.tsx > 쿨다운 종료 > "재발송" 버튼이 활성화(outline variant)` 한 케이스만 실패.

```
expect(element).not.toBeDisabled()
Received element is disabled:
  <button aria-label="재발송 대기 중, 30초 남음" disabled="">
```

`재발송 (30s)`, `03:00` 표시 → `resendCooldown=30`, `timeLeft=180` 초기값 그대로.

## 근본원인

`apps/web/components/auth/__tests__/phone-verification.test.tsx:96-104`:

```js
await user.click(screen.getByRole('button', { name: /인증번호 발송/ }));
// 30초 경과
vi.advanceTimersByTime(30_000);
await waitFor(() => {
  const btn = screen.getByRole('button', { name: /재발송/ });
  expect(btn).not.toBeDisabled();
});
```

Race condition:
1. `await user.click()`은 click 이벤트 dispatch까지만 await — handleSendCode의 `await apiClient.post()` 마이크로태스크 완료를 기다리지 않음
2. `vi.advanceTimersByTime(30_000)`이 setResendCooldown(30) **이전에** 실행됨
3. 그 시점 setInterval이 아직 생성되지 않아 advance가 무의미
4. waitFor가 폴링하지만 추가 timer advance가 없어 카운트다운 진행 안 됨

로컬에선 우연히 통과 (CPU 빠름 → 마이크로태스크가 advance 전에 완료). CI는 느려서 일관되게 실패.

## 수정안

쿨다운 UI(`재발송 (30s)`)가 렌더된 뒤에 `vi.advanceTimersByTime`을 호출하도록 변경. `act(() => ...)` 래핑으로 React state flush 보장.

```js
await user.click(screen.getByRole('button', { name: /인증번호 발송/ }));

// 쿨다운 카운트다운 시작될 때까지 대기 (race 방지)
await waitFor(() => {
  expect(screen.getByText(/재발송 \(30s\)/)).toBeInTheDocument();
});

// 30초 경과
await act(async () => {
  vi.advanceTimersByTime(30_000);
});

await waitFor(() => {
  const btn = screen.getByRole('button', { name: /재발송/ });
  expect(btn).not.toBeDisabled();
});
```

`act` import 추가: `import { render, screen, waitFor, act } from '@testing-library/react';`

## 작업

1. `apps/web/components/auth/__tests__/phone-verification.test.tsx` 수정
2. 로컬에서 테스트 실행해 통과 확인
3. 커밋 + push

## 검증

```bash
pnpm --filter @grapit/web test -- --run components/auth/__tests__/phone-verification.test.tsx
```

`gh pr checks 16` → success.
