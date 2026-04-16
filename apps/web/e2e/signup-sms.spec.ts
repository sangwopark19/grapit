import { test, expect } from '@playwright/test';

/**
 * SMS Mock 모드 E2E 테스트 (Plan 09에서 GREEN 전환 예정)
 *
 * CI 환경에서 INFOBIP_API_KEY 미설정 -> dev mock 자동 진입
 * 000000 유니버설 코드로 회원가입 플로우 완주
 */

test.describe('회원가입 SMS 인증 (mock 모드)', () => {
  test('회원가입 step3까지 진행 -> 전화번호 입력 -> 발송 -> 000000 입력 -> 인증 완료', async ({
    page,
  }) => {
    // Step 1: 회원가입 페이지 접근
    await page.goto('/auth/signup');

    // Step 2: 이메일/비밀번호 입력 (step 1-2)
    // Plan 09에서 구현: 기존 signup form step 1-2 진행

    // Step 3: 전화번호 입력
    const phoneInput = page.getByPlaceholder('010-0000-0000');
    await phoneInput.fill('01012345678');

    // 인증번호 발송
    await page.getByRole('button', { name: /인증번호 발송/ }).click();

    // 인증번호 6자리 입력 (mock 모드: 000000)
    const codeInput = page.getByPlaceholder('인증번호 6자리');
    await expect(codeInput).toBeVisible();
    await codeInput.fill('000000');

    // 확인 버튼 클릭
    await page.getByRole('button', { name: '확인' }).click();

    // 인증 완료 확인
    await expect(page.getByText('인증 완료')).toBeVisible();
  });

  test('잘못된 코드 입력 시 "인증번호가 일치하지 않습니다"', async ({ page }) => {
    await page.goto('/auth/signup');

    const phoneInput = page.getByPlaceholder('010-0000-0000');
    await phoneInput.fill('01012345678');

    await page.getByRole('button', { name: /인증번호 발송/ }).click();

    const codeInput = page.getByPlaceholder('인증번호 6자리');
    await expect(codeInput).toBeVisible();
    await codeInput.fill('999999');

    await page.getByRole('button', { name: '확인' }).click();

    await expect(page.getByText('인증번호가 일치하지 않습니다')).toBeVisible();
  });

  test('30초 쿨다운 "재발송 (Ns)" 라벨 존재 확인', async ({ page }) => {
    await page.goto('/auth/signup');

    const phoneInput = page.getByPlaceholder('010-0000-0000');
    await phoneInput.fill('01012345678');

    await page.getByRole('button', { name: /인증번호 발송/ }).click();

    // 쿨다운 라벨 확인: "재발송 (30s)" or similar
    await expect(page.getByText(/재발송.*\d+s/)).toBeVisible();
  });
});
