---
phase: 10
plan: 09
type: execute
wave: 5
depends_on: [10-01, 10-05, 10-06, 10-07, 10-08]
files_modified:
  - apps/web/e2e/signup-sms.spec.ts
  - apps/api/test/sms-throttle.integration.spec.ts
  - .planning/phases/10-sms/DEPLOY-CHECKLIST.md
autonomous: false
requirements: [SMS-01, SMS-02, SMS-03, SMS-04]
must_haves:
  truths:
    - "signup-sms.spec.ts가 mock 모드(000000)로 회원가입 전 플로우를 Playwright에서 완주"
    - "sms-throttle.integration.spec.ts가 testcontainers Valkey + 실 throttler로 limit + 1번째 429 검증"
    - "apps/api typecheck / lint / test / test:integration 모두 green"
    - "apps/web typecheck / lint / test / test:e2e 모두 green"
    - "staging 수동 SMS smoke 결과(개발자 본인 번호로 발송/검증 완료) 기록됨 (D-25)"
    - "Phase 10의 success criteria 4개 모두 충족 증거 보유"
  artifacts:
    - path: "apps/web/e2e/signup-sms.spec.ts"
      provides: "Playwright CI mock 회원가입 플로우"
      contains: "000000"
    - path: "apps/api/test/sms-throttle.integration.spec.ts"
      provides: "testcontainers Valkey throttler integration 테스트 (Plan 01 RED→GREEN)"
      contains: "testcontainers"
    - path: ".planning/phases/10-sms/DEPLOY-CHECKLIST.md"
      provides: "Staging smoke 결과 + Infobip 콘솔 사전 작업 체크리스트 (Plan 02에서 생성된 문서를 업데이트)"
      contains: "staging smoke"
  key_links:
    - from: "signup-sms.spec.ts"
      to: "phone-verification.tsx"
      via: "data-testid 또는 label로 컴포넌트 인터랙션"
      pattern: "인증번호 발송|인증번호 6자리"
    - from: "sms-throttle.integration.spec.ts"
      to: "ThrottlerModule"
      via: "실 ioredis + ThrottlerStorageRedisService 검증"
      pattern: "ThrottlerStorageRedisService"
---

<objective>
Phase 10의 모든 구현(Plan 02~08)을 실제로 연결하고 검증한다. Wave 0(Plan 01)에서 RED로 작성된 E2E / integration 테스트를 GREEN으로 전환하고, staging 수동 smoke(D-25)를 human checkpoint로 체크한다. Phase 10의 4개 success criteria(실 SMS 수신, rate limiting, 재시도/만료, dev mock 자동 전환)가 모두 달성됨을 근거를 갖고 기록.

Purpose: 자동화 테스트로는 staging 실 SMS 비용 발생 방지(D-25)와 Infobip 콘솔 상태(D-04 발신번호 KISA 승인 등)를 확인할 수 없으므로, 최종 phase 승인 전 human verify 체크포인트가 필수. integration 테스트는 testcontainers로 실 Valkey Lua 스크립트 동작을 검증.

Output: E2E spec + integration spec GREEN 전환 + DEPLOY-CHECKLIST.md 업데이트(수동 smoke 결과 기록) + 최종 phase verification 로그.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/10-sms/10-CONTEXT.md
@.planning/phases/10-sms/10-RESEARCH.md
@.planning/phases/10-sms/10-UI-SPEC.md
@.planning/phases/10-sms/10-VALIDATION.md
@.planning/phases/10-sms/DEPLOY-CHECKLIST.md
@apps/web/e2e/signup-sms.spec.ts
@apps/api/test/sms-throttle.integration.spec.ts
@apps/web/e2e/social-login.spec.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <id>10-09-T1</id>
  <name>Task 1: signup-sms.spec.ts — mock 모드 회원가입 E2E 완주</name>
  <files>apps/web/e2e/signup-sms.spec.ts</files>
  <behavior>
    - Playwright가 `/auth/signup` 페이지로 이동하여 회원가입 step1/step2/step3 플로우를 완주
    - step3에서 전화번호 입력 → "인증번호 발송" 클릭 → mock 모드 → "인증번호 6자리"에 `000000` 입력 → "확인" 클릭 → "인증 완료" 노출 확인
    - 30s 쿨다운 테스트: 발송 직후 재발송 버튼에 `재발송 (`로 시작하는 라벨이 보이는지 확인 (정확한 초는 timing-sensitive하므로 regex `/재발송 \(\d+s\)/` 사용)
    - 만료 타이머 표시 확인: `00:\d\d` 또는 `0\d:\d\d` 포맷 텍스트 존재
    - 본 테스트는 `test.describe.skip` 대신 정규 실행 (Plan 01에서 RED 스캐폴딩으로 작성된 파일을 GREEN으로 전환)
    - CI 환경: `INFOBIP_API_KEY` 미주입 + `NODE_ENV=test` → mock 모드 자동 진입 (D-24)
    - CI에서 실 SMS 발송 금지
  </behavior>
  <read_first>
    - apps/web/e2e/signup-sms.spec.ts (Plan 01에서 작성한 RED 스캐폴딩)
    - apps/web/e2e/social-login.spec.ts (Playwright 구문 참조)
    - apps/web/components/auth/phone-verification.tsx (Plan 08 최종 구현, label/placeholder 참조)
    - .planning/phases/10-sms/10-CONTEXT.md D-24, D-25
    - .planning/phases/10-sms/10-UI-SPEC.md §"Copywriting Contract" (버튼/인풋 라벨 확정 값)
  </read_first>
  <action>
    **Plan 01 스캐폴딩(RED)을 실 작동 E2E 스펙으로 전환.**

    구성:
    ```typescript
    import { test, expect } from '@playwright/test';

    test.describe('Signup SMS mock flow', () => {
      test('전화번호 인증을 거쳐 회원가입 step3까지 완주 (000000 mock)', async ({ page }) => {
        await page.goto('/auth/signup');

        // Step 1: 이메일 입력 (signup-step1 구조는 프로젝트 UI 따름)
        // Step 2: 비밀번호 입력
        // Step 3: 전화번호 인증
        // ...
        // (실 Step 구조는 /auth/signup 에 접근해 확인 후 작성. 핵심은 step3 phone-verification 부분)

        // step3에 도달했다고 가정
        const phoneInput = page.getByPlaceholder(/010-0000-0000/);
        await phoneInput.fill('010-1234-5678');
        await page.getByRole('button', { name: '인증번호 발송' }).click();

        // 쿨다운 라벨 존재 확인
        await expect(page.getByRole('button', { name: /재발송 \(\d+s\)/ })).toBeVisible();

        // 만료 타이머 표시 확인 (MM:SS 포맷)
        await expect(page.locator('text=/^0[0-2]:\\d{2}$/')).toBeVisible();

        // 인증번호 입력
        const codeInput = page.getByPlaceholder(/인증번호 6자리/);
        await codeInput.fill('000000');
        await page.getByRole('button', { name: '확인' }).click();

        // "인증 완료" 상태 확인
        await expect(page.getByText('인증 완료')).toBeVisible();
      });

      test('잘못된 인증번호 입력 시 "인증번호가 일치하지 않습니다" 에러 표시', async ({ page }) => {
        await page.goto('/auth/signup');
        // ... step3 진입
        const phoneInput = page.getByPlaceholder(/010-0000-0000/);
        await phoneInput.fill('010-1234-5678');
        await page.getByRole('button', { name: '인증번호 발송' }).click();

        const codeInput = page.getByPlaceholder(/인증번호 6자리/);
        await codeInput.fill('111111');
        await page.getByRole('button', { name: '확인' }).click();

        await expect(page.getByText('인증번호가 일치하지 않습니다')).toBeVisible();
      });
    });
    ```

    **실 구현 시 주의:**
    - `/auth/signup`의 step1/step2 정확한 필드/버튼은 `apps/web/components/auth/signup-form.tsx` + `signup-step1.tsx` / `signup-step2.tsx`에서 확인 후 채움 (execute 단계 executor가 읽음)
    - CI env: `playwright.config.ts` webServer command에서 `NODE_ENV=test INFOBIP_API_KEY=` 주입 확인 (Plan 02 DEPLOY-CHECKLIST가 이미 문서화)
    - Flaky 방지: `waitFor` 대신 `expect().toBeVisible({ timeout: 10_000 })` 사용
    - 30s 쿨다운 타이머 숫자는 정확 매칭 금지(시간 타이밍) — regex로 `\d+s`만 확인
    - `test.fixme` 사용 금지 (Phase 9.1 정리 교훈)
    - CI에서 실 Infobip 호출 금지: `INFOBIP_API_KEY` 미주입이 유일한 mock 진입 조건 (D-24)
  </action>
  <acceptance_criteria>
    - `test -f apps/web/e2e/signup-sms.spec.ts`
    - `grep -q "000000" apps/web/e2e/signup-sms.spec.ts`
    - `grep -q "인증 완료" apps/web/e2e/signup-sms.spec.ts`
    - `grep -q "인증번호가 일치하지 않습니다" apps/web/e2e/signup-sms.spec.ts`
    - `grep -q "재발송" apps/web/e2e/signup-sms.spec.ts`
    - `grep -qv "test.fixme\|test.skip" apps/web/e2e/signup-sms.spec.ts` (정규 실행 상태)
    - `pnpm --filter @grapit/web test:e2e -- signup-sms.spec.ts` exits 0
  </acceptance_criteria>
  <verify>
    <automated>pnpm --filter @grapit/web test:e2e -- signup-sms.spec.ts</automated>
  </verify>
  <requirements>SMS-02, SMS-03, SMS-04</requirements>
  <autonomous>true</autonomous>
  <commit>test(10-09): wire signup-sms E2E mock flow (GREEN Wave 0 spec)</commit>
  <done>Playwright가 mock 회원가입 플로우 완주, 인증 완료 UI 노출, 잘못된 코드 에러 분기 확인, CI green</done>
</task>

<task type="auto" tdd="true">
  <id>10-09-T2</id>
  <name>Task 2: sms-throttle.integration.spec.ts — testcontainers Valkey + 실 throttler GREEN 전환</name>
  <files>apps/api/test/sms-throttle.integration.spec.ts</files>
  <behavior>
    - testcontainers `valkey/valkey:8` 또는 `redis:7` 이미지 start
    - NestJS TestingModule로 AppModule 부트스트랩, REDIS_URL을 container 주소로 override
    - **send-code IP axis (D-06)**: 같은 IP로 서로 다른 phone 21번째 호출 시 429 수신
    - **send-code phone axis (D-06)**: 같은 phone으로 서로 다른 IP 6번째 호출 시 429 수신 (`sms:send_count:+821012345678` INCR 검증)
    - **verify-code IP axis (D-07)**: 같은 IP로 서로 다른 phone 11번째 호출 시 429 수신
    - **verify-code phone axis (D-07)**: 같은 phone으로 서로 다른 IP 11번째 호출 시 429 수신 (`sms:verify_count:+821012345678` INCR 검증)
    - 다른 IP + 다른 phone으로 호출 시 독립 카운트 확인
    - password-reset throttle: 같은 IP로 4번째 호출 시 429 수신 (기존 3/15min)
    - Infobip API는 global.fetch mock으로 intercept (비용 발생 방지)
    - 테스트 완료 후 container 정상 종료
  </behavior>
  <read_first>
    - apps/api/test/sms-throttle.integration.spec.ts (Plan 01 RED 스캐폴딩)
    - apps/api/vitest.integration.config.ts (testcontainers hookTimeout/testTimeout 확인)
    - apps/api/src/app.module.ts (Plan 07 forRootAsync 구현)
    - apps/api/src/modules/sms/sms.controller.ts (Plan 06 @Throttle)
    - apps/api/src/modules/auth/auth.controller.ts:118-135 (password-reset)
    - .planning/phases/10-sms/10-CONTEXT.md D-06, D-07, D-08, D-09
    - .planning/phases/10-sms/10-RESEARCH.md §"Pattern 2 Caveat"
  </read_first>
  <action>
    **Plan 01 스캐폴딩(RED)을 실 testcontainers 통합 테스트로 전환.**

    **구조:**
    ```typescript
    import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
    import { GenericContainer, StartedTestContainer } from 'testcontainers';
    import { Test } from '@nestjs/testing';
    import type { INestApplication } from '@nestjs/common';
    import request from 'supertest';
    import { AppModule } from '../src/app.module.js';

    describe('SMS throttle integration (testcontainers Valkey)', () => {
      let container: StartedTestContainer;
      let app: INestApplication;

      beforeAll(async () => {
        container = await new GenericContainer('redis:7-alpine')
          .withExposedPorts(6379)
          .start();
        const url = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
        process.env.REDIS_URL = url;

        // Infobip fetch mock (비용 발생 방지)
        vi.stubGlobal('fetch', vi.fn(async () => new Response(
          JSON.stringify({ pinId: 'MOCK_PIN_ID', to: '821012345678' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )));
        // INFOBIP env 미주입 상태 = dev mock → 000000만 수락
        // 또는 fake env 주입으로 real path 테스트도 가능 (planner 결정: 본 integration은 throttle만 검증 → dev mock ok)

        const mod = await Test.createTestingModule({
          imports: [AppModule],
        }).compile();
        app = mod.createNestApplication();
        await app.init();
      }, 120_000);

      afterAll(async () => {
        await app?.close();
        await container?.stop();
      });

      it('send-code IP 20/h throttle: 21번째 요청 429', async () => {
        const ip = '192.168.1.100';
        for (let i = 0; i < 20; i++) {
          const res = await request(app.getHttpServer())
            .post('/sms/send-code')
            .set('X-Forwarded-For', ip)
            .send({ phone: `0101234${String(i).padStart(4, '0')}` });
          expect([200, 429]).toContain(res.status); // 일부는 30s cooldown으로 실패 가능
        }
        // 21번째는 IP throttle로 429
        const res = await request(app.getHttpServer())
          .post('/sms/send-code')
          .set('X-Forwarded-For', ip)
          .send({ phone: '01099999999' });
        expect(res.status).toBe(429);
      });

      it('verify-code 10/15min throttle: 11번째 요청 429', async () => {
        const ip = '192.168.1.101';
        for (let i = 0; i < 10; i++) {
          await request(app.getHttpServer())
            .post('/sms/verify-code')
            .set('X-Forwarded-For', ip)
            .send({ phone: '01011112222', code: '000000' });
        }
        const res = await request(app.getHttpServer())
          .post('/sms/verify-code')
          .set('X-Forwarded-For', ip)
          .send({ phone: '01011112222', code: '000000' });
        expect(res.status).toBe(429);
      });

      it('password-reset 3/15min throttle 유지 (D-09 — storage 이전 후에도 동작 그대로)', async () => {
        const ip = '192.168.1.102';
        for (let i = 0; i < 3; i++) {
          await request(app.getHttpServer())
            .post('/auth/password-reset/request')
            .set('X-Forwarded-For', ip)
            .send({ email: `test${i}@grapit.test` });
        }
        const res = await request(app.getHttpServer())
          .post('/auth/password-reset/request')
          .set('X-Forwarded-For', ip)
          .send({ email: 'test4@grapit.test' });
        expect(res.status).toBe(429);
      });

      it('다른 IP로 호출 시 독립 카운트 유지', async () => {
        const res = await request(app.getHttpServer())
          .post('/sms/send-code')
          .set('X-Forwarded-For', '10.0.0.1')
          .send({ phone: '01012345678' });
        expect(res.status).not.toBe(429); // 새 IP는 429 아님 (200 또는 다른 성공)
      });

      it('send-code phone axis 5/3600s throttle: 동일 phone, 다중 IP 6번째 429 (D-06)', async () => {
        const phone = '01077778888';
        for (let i = 0; i < 5; i++) {
          await request(app.getHttpServer())
            .post('/sms/send-code')
            .set('X-Forwarded-For', `172.16.0.${10 + i}`)
            .send({ phone });
          // Valkey 내부 sms:resend:+82...가 30s cooldown을 거니 IP 변경으로도 cooldown hit 가능
          // 본 케이스는 send_count axis 검증이 목적이므로 cooldown 우회를 위해 test code 쪽에서 redis.del 또는 시간 이동 필요 시 vitest fake timers 검토
        }
        const res = await request(app.getHttpServer())
          .post('/sms/send-code')
          .set('X-Forwarded-For', '172.16.0.99')
          .send({ phone });
        expect(res.status).toBe(429); // phone axis 429
      });

      it('verify-code phone axis 10/900s throttle: 동일 phone, 다중 IP 11번째 429 (D-07)', async () => {
        const phone = '01088889999';
        for (let i = 0; i < 10; i++) {
          await request(app.getHttpServer())
            .post('/sms/verify-code')
            .set('X-Forwarded-For', `172.17.0.${10 + i}`)
            .send({ phone, code: '123456' });
        }
        const res = await request(app.getHttpServer())
          .post('/sms/verify-code')
          .set('X-Forwarded-For', '172.17.0.99')
          .send({ phone, code: '123456' });
        expect(res.status).toBe(429); // phone axis 429
      });
    });
    ```

    **주의사항:**
    - testcontainers 이미지 pull 첫 실행 시 60s+ 소요 → hookTimeout 120_000 (vitest.integration.config.ts 이미 설정)
    - `supertest`가 apps/api devDependencies에 없을 수 있음 — 테스트 추가 시 `pnpm --filter @grapit/api add -D supertest @types/supertest` 실행. 단, 이미 존재하면 추가 불필요 (check first)
    - `X-Forwarded-For` trust proxy 설정이 필요할 수 있음 → `app.set('trust proxy', true)` OR ThrottlerGuard custom tracker 확인
    - Infobip fetch mock: 실 호출 방지 + 응답 shape는 fixture JSON 재사용 가능
    - password-reset throttle 테스트는 실 email 발송 트리거하지 않도록 EmailService도 mock 필요할 수 있음 — 현실적으로 test에서 authService 의존성 주입 시 emailService를 mock override하는 것이 안전
    - 실행 시간 목표: 전체 integration 스위트 ~30s (테스트 내부 루프 최적화 필요 시 `Promise.all` 활용)
  </action>
  <acceptance_criteria>
    - `grep -q "testcontainers" apps/api/test/sms-throttle.integration.spec.ts`
    - `grep -q "GenericContainer" apps/api/test/sms-throttle.integration.spec.ts`
    - `grep -q "REDIS_URL" apps/api/test/sms-throttle.integration.spec.ts`
    - `grep -q "expect(res.status).toBe(429)" apps/api/test/sms-throttle.integration.spec.ts`
    - `grep -q "password-reset" apps/api/test/sms-throttle.integration.spec.ts` (D-09 회귀 방지)
    - `grep -q "sms:send_count:\|sms:verify_count:\|phone axis" apps/api/test/sms-throttle.integration.spec.ts` (D-06/D-07 phone axis 검증)
    - `grep -c "D-06\|D-07" apps/api/test/sms-throttle.integration.spec.ts` ≥ 2
    - `grep -qv "it.skip\|describe.skip" apps/api/test/sms-throttle.integration.spec.ts`
    - `pnpm --filter @grapit/api test:integration sms-throttle -- --run` exits 0
    - Docker 실행 중이어야 함 (CI에서 Docker-in-Docker 가용 브랜치에서만 실행, vitest.integration.config.ts 정책 준수)
  </acceptance_criteria>
  <verify>
    <automated>pnpm --filter @grapit/api test:integration sms-throttle -- --run</automated>
  </verify>
  <requirements>SMS-01</requirements>
  <autonomous>true</autonomous>
  <commit>test(10-09): wire sms-throttle integration test with testcontainers Valkey</commit>
  <done>testcontainers Valkey 컨테이너 기동, IP/phone 축 throttle + password-reset 회귀 테스트 모두 GREEN, Infobip fetch mock으로 실 발송 없음</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <id>10-09-T3</id>
  <name>Task 3: Staging 수동 SMS smoke (D-25) + DEPLOY-CHECKLIST 기록</name>
  <files>.planning/phases/10-sms/DEPLOY-CHECKLIST.md</files>
  <read_first>
    - .planning/phases/10-sms/DEPLOY-CHECKLIST.md (Plan 02에서 생성된 Infobip 콘솔 사전작업 체크리스트)
    - .planning/phases/10-sms/10-CONTEXT.md D-04, D-14, D-17, D-24, D-25
    - apps/api/src/modules/sms/sms.service.ts (Plan 05 구현 — hard-fail 생성자 검증 근거)
    - apps/web/components/auth/phone-verification.tsx (Plan 08 구현 — 실 수신 UX 검증 근거)
  </read_first>
  <what-built>
    Plan 02~08의 모든 구현이 완료되었고, 자동화 테스트(Task 1, 2)가 green. Infobip 실 발송 경로는 CI 비용 방지로 자동 검증 불가. 최종 phase 승인 전 staging 수동 smoke가 D-25에서 필수로 지정됨.
  </what-built>
  <action>
    (체크포인트 태스크 — Claude는 스스로 실행할 수 없고 사용자에게 staging smoke 절차를 수행한 뒤 결과를 `.planning/phases/10-sms/DEPLOY-CHECKLIST.md`의 "Staging smoke 결과" 섹션에 기록하도록 요청한다. 사용자가 "approved"를 입력하면 해당 결과를 commit한다.)

    **사용자 제공 정보 수집 후 Claude 실행 단계:**
    1. 사용자가 alt한 smoke 결과(실행 일시 · 번호 부분 마스킹 · 수신 latency · 통과/실패 · Sentry 링크)를 DEPLOY-CHECKLIST.md §"Staging smoke 결과" 섹션에 append
    2. 실패한 단계가 있으면 실패 내용 + 재현 단계 기록 후 gap closure 안내
    3. 통과 시 commit: `docs(10-09): record staging smoke results for Phase 10`
  </action>
  <how-to-verify>
    **운영자(=개발자 본인) 단계:**

    1. Infobip 콘솔 점검 (DEPLOY-CHECKLIST.md §"Infobip 사전 작업"):
       - Application 존재, `pinAttempts=5 / pinTimeToLive=3m / pinLength=6 / pinType=NUMERIC` 설정 확인
       - Message Template 존재, `senderId=Grapit` 또는 KISA 등록된 발신번호 확인
       - API Key 발급됨, GCP Secret Manager에 `INFOBIP_API_KEY / INFOBIP_BASE_URL / INFOBIP_APPLICATION_ID / INFOBIP_MESSAGE_ID` 4종 주입 (D-16, D-17)
       - GitHub Actions secrets 동일 키 4종 주입, `TWILIO_*` 3종 제거 확인

    2. Staging 배포 성공 및 health check:
       - `gcloud run deploy`가 에러 없이 완료
       - `/health`가 200 응답 (Valkey ping 포함)
       - Cloud Run 로그에서 `[sms] ... credential_missing` 또는 `dev_mock` 경고 **없음**
       - hard-fail 확인: env 중 일부를 의도적으로 비웠을 때 부팅 실패 로그 확인(D-14 검증 — 별도 테스트 환경에서만)

    3. 본인 번호로 실 SMS 발송:
       - Staging `/auth/signup` 접근 → 본인 전화번호 입력 → "인증번호 발송" 클릭
       - 5~10초 이내 SMS 수신 (D-01 Kakao 사례 기준 한국은 10분 이내지만 테스트에서는 초 단위 기대)
       - SMS 내용에 `[Grapit] 인증번호 NNNNNN (3분 이내 입력)` 포맷 확인
       - 수신한 6자리 코드를 입력 → "확인" 클릭 → "인증 완료" 표시
       - 30s 쿨다운 경과 후 "재발송" 활성화 확인

    4. 실패 시나리오 샘플링:
       - 잘못된 코드 5회 입력 → 410 "인증번호가 만료되었습니다" UI 표시 (D-12 attempts exhausted)
       - 신규 번호 입력 후 곧바로 재발송 클릭 → 30s 쿨다운 버튼 disabled + "재발송 (Ns)" 라벨 (D-11)
       - (선택) 태국 등 국제 번호 입력 → SMS 수신 확인 (필요 시 스킵)

    5. `.planning/phases/10-sms/DEPLOY-CHECKLIST.md` 업데이트:
       - "Staging smoke 결과" 섹션에 실행 일시, 번호(부분 마스킹), 수신 latency, 검증 성공 여부 기록
       - 실패 시 이슈 재현 단계 기록 후 재검증
       - Sentry 대시보드 링크(`sms.*` 이벤트 발생 건수) 참고 기록

    **Return Signal:**
    - 통과 시: "approved" — Phase 10 종료로 진행
    - 이슈 발견 시: 이슈 설명 + 재현 단계. 필요 시 gap closure plan 작성 (`/gsd-plan-phase --gaps`)
  </how-to-verify>
  <acceptance_criteria>
    - `grep -q "Staging smoke 결과" .planning/phases/10-sms/DEPLOY-CHECKLIST.md`
    - `grep -qE "(통과|approved|✅)" .planning/phases/10-sms/DEPLOY-CHECKLIST.md`
    - `grep -q "실행 일시" .planning/phases/10-sms/DEPLOY-CHECKLIST.md`
    - Phase 10 success criteria 4개에 대한 통과 체크 항목 존재
  </acceptance_criteria>
  <verify>
    <automated>grep -qE "Staging smoke 결과|실행 일시" .planning/phases/10-sms/DEPLOY-CHECKLIST.md && echo "checklist updated"</automated>
  </verify>
  <resume-signal>Type "approved" to close Phase 10, or describe issues encountered during staging smoke for gap closure planning.</resume-signal>
  <requirements>SMS-01, SMS-02, SMS-03, SMS-04</requirements>
  <autonomous>false</autonomous>
  <commit>docs(10-09): record staging smoke results and close Phase 10 checklist</commit>
  <done>DEPLOY-CHECKLIST.md에 staging smoke 실행 결과 기록됨, 4개 success criteria 모두 검증 증거 보유</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CI → Infobip API | D-25: 실 발송 금지. mock 모드 자동 진입 필수 |
| staging → Infobip (실 발송) | 운영자 수동 검증, 본인 번호로 비용 통제 |
| test container → Valkey | testcontainers 격리된 네트워크, 프로세스 종료 시 파기 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-09-01 | Information Disclosure | CI에서 실 Infobip API key 노출 | mitigate | CI env에 `INFOBIP_API_KEY` 미주입 → SmsService dev mock 자동 진입(D-24) + `000000` 유니버설 코드 |
| T-10-09-02 | DoS | staging smoke 중 실 SMS 비용 폭주 | mitigate | 본인 번호 1회 발송 + Infobip sendPinPerPhoneNumberLimit 5/1h로 상한 |
| T-10-09-03 | Tampering | hard-fail 회귀 감지 실패 | mitigate | Wave 0 `sms.service.spec.ts`의 "production hard-fail" 케이스가 unit test 레이어에서 회귀 감지 |
| T-10-09-04 | Information Disclosure | DEPLOY-CHECKLIST.md에 실 번호 커밋 | mitigate | 번호 부분 마스킹(예: `010-****-5678`) 기록, 전체 번호 금지 |
</threat_model>

<verification>
- `pnpm --filter @grapit/api typecheck` green
- `pnpm --filter @grapit/api lint` green
- `pnpm --filter @grapit/api test --run` green
- `pnpm --filter @grapit/api test:integration --run` green (Docker 필요)
- `pnpm --filter @grapit/web typecheck` green
- `pnpm --filter @grapit/web lint` green
- `pnpm --filter @grapit/web test --run` green
- `pnpm --filter @grapit/web test:e2e` green
- Staging smoke 완료 + DEPLOY-CHECKLIST.md 업데이트
- Phase 10 success criteria 4/4 증거 매핑
</verification>

<success_criteria>
- E2E signup-sms.spec.ts + integration sms-throttle.spec.ts 모두 CI green
- 자동화 테스트 + 수동 staging smoke 이중 검증으로 SMS-01/02/03/04 requirement 전부 충족
- DEPLOY-CHECKLIST.md에 Infobip 콘솔 구성 상태 + staging smoke 결과 기록
- Phase 10 성공 기준 4개(실 SMS 수신 / rate limiting / 재시도·만료 / dev mock 자동 전환) 증거 확보
- T-10-*-01~05 등 HIGH 위협 mitigation이 실제 동작함 증명
</success_criteria>

<output>
After completion, create `.planning/phases/10-sms/10-09-SUMMARY.md` with:
- E2E/integration 테스트 실행 결과 요약 (pass count, duration)
- Staging smoke timestamp + 수신 latency + 성공 여부
- Phase 10 success criteria 4개에 대한 evidence 매핑 테이블
- Phase 종료 전 발견된 issue (없으면 "없음") 또는 gap closure 필요 여부
</output>
