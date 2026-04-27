# Phase 15: Resend heygrabit.com cutover — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 3 (code) + 1 (operational doc)
**Analogs found:** 3 / 3 (code 파일에 대해 100%), 운영 작업 (DNS/Secret/Cloud Run) 은 no-code analog — Plan 의 runbook 으로 이관

---

## Scope Note

Phase 15 는 운영 중심 cutover phase 이며, CONTEXT D-11 에 의해 code 변경은 `email.service.ts` L77-82 에 Sentry.captureException 5~10 라인 추가 + spec 업데이트 단 한 세트로 범위가 고정된다. 나머지 operational tasks (Resend 콘솔, 후이즈 DNS, `gcloud secrets`, `gcloud run services update`) 는 코드 분석 대상이 아니므로 PATTERNS.md 에서는 "No code analog — see gcloud/dig runbook in Plan" 으로 표기한다. DNS 레코드 리터럴 값은 Resend 대시보드가 발급하는 값이 진실의 원천이라 RESEARCH §Pitfall 1 에 따라 하드코딩 금지 — planner 가 Plan 에서 "대시보드 값을 그대로 등록" 지시로 작성해야 한다.

---

## File Classification

| File (new / modified) | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/api/src/modules/auth/email/email.service.ts` (modified, L77-82 증보) | service — transactional email sender | request-response (error-branch observability) | `apps/api/src/modules/sms/sms.service.ts` L320-329 (send-failure Sentry) | exact — 둘 다 외부 메시징 SDK 의 실패 분기에서 `Sentry.withScope + captureException` 호출 |
| `apps/api/src/modules/auth/email/email.service.spec.ts` (modified, 신규 케이스 1~2 개) | test (unit, vitest) | test — mock external SDK + assert Sentry called | 동일 파일 L86-99 ("PROD SDK error" 케이스) + `apps/api/src/modules/admin/admin-diagnostics.controller.ts` (Sentry 직접 호출 패턴) | role-match — 기존 spec 구조 그대로 + Sentry mock 은 `vi.mock('@sentry/nestjs')` 신규 패턴 필요 (apps/api 전체에 Sentry mock 선례 전무) |
| `15-HUMAN-UAT.md` (new) | operational audit log (markdown) | documentation (check-list + 운영 로그 축적) | `.planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/14-HUMAN-UAT.md` | exact — 같은 phase 성격 (production UAT + 72h 관측 창) |
| 운영 작업 (Resend 도메인 추가 / 후이즈 DNS / Secret rotate / Cloud Run redeploy) | — | — | **No code analog — see gcloud/dig runbook in Plan** | — |

---

## Pattern Assignments

### `apps/api/src/modules/auth/email/email.service.ts` (service, request-response)

**Analog:** `apps/api/src/modules/sms/sms.service.ts`
**Role match:** 둘 다 외부 메시징 provider (Infobip SMS / Resend email) 를 NestJS service 에서 호출하고, SDK 실패 시 `logger.error + Sentry` 로 관측성 surface.

**Imports pattern** — analog `sms.service.ts` L1-11:

```typescript
import {
  Inject, Injectable, BadRequestException, GoneException, HttpException,
  HttpStatus, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { randomInt } from 'node:crypto';
import type IORedis from 'ioredis';
// ...
```

→ **Apply to target (email.service.ts L1-4):** 현재 import 블록에 `import * as Sentry from '@sentry/nestjs';` 단 한 줄만 추가. namespace import 관행 유지 (sms.service.ts + http-exception.filter.ts + admin-diagnostics.controller.ts 모두 동일).

---

**Core pattern — send-failure Sentry withScope** (analog `sms.service.ts` L320-332, send 실패 분기):

```typescript
      const country = e164.startsWith('+82') ? 'KR' : 'unknown';
      Sentry.withScope((scope) => {
        scope.setTag('provider', 'infobip');
        scope.setTag('country', country);
        if (err instanceof InfobipApiError) {
          scope.setTag('http_status', String(err.status));
        }
        scope.setLevel('error');
        Sentry.captureException(err);
      });
      this.logger.error({ event: 'sms.send_failed', phone: e164, err: (err as Error).message });
      throw new BadRequestException('인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
```

→ **Apply to target (email.service.ts L77-80):** 기존 `logger.error` 와 `return` 사이에 `Sentry.withScope((scope) => { … Sentry.captureException(…) })` 삽입. 구조는 sms.service.ts 의 send 실패 블록과 1:1 대응. 차이점:

1. **순서:** sms 는 `Sentry.withScope → logger.error` 순, email 은 `logger.error` 가 먼저 있으므로 **logger.error 바로 뒤에 withScope 블록 추가** (CONTEXT D-11 "바로 다음 줄" 지시 준수).
2. **PII masking:** SMS 는 `country = e164.startsWith('+82') ? 'KR' : 'unknown'` 로 전화번호 본문 대신 국가 태그만 남긴다. 이메일도 동일 원칙 — `to` 전체가 아닌 **도메인만** `scope.setContext('email', { toDomain: to.split('@')[1] ?? 'unknown' })` 로 기록 (RESEARCH §Pattern 1 + "Don't Hand-Roll" PII masking 행).
3. **Tags:** `provider: 'resend'`, `component: 'email-service'` (CONTEXT D-11 예시) + 필요 시 `scope.setLevel('error')`.
4. **throw 안 함:** sms 는 마지막에 `throw new BadRequestException(...)` 하지만, email 은 D-12 의 fire-and-forget + enumeration 방어로 인해 기존 `return { success: false, error: error.message }` 유지.
5. **captureException 인자:** `error` 는 Resend SDK 의 plain object (not `Error`) — analog sms 는 `throw` 된 `err`(Error instance) 를 넘긴다. Email 에서는 `new Error(\`Resend send failed: ${error.message}\`)` 로 래핑하는 것이 RESEARCH §Pattern 1 권장안 (Sentry stack trace 품질 보장).

권장 구현 (RESEARCH §Pattern 1 L172-195 그대로 인용):

```typescript
if (error) {
  this.logger.error(`Resend send failed for ${to}: ${error.message}`);
  // [Phase 15 D-11] Surface to Sentry for observability — silent failure 방어.
  Sentry.withScope((scope) => {
    scope.setTag('component', 'email-service');
    scope.setTag('provider', 'resend');
    scope.setLevel('error');
    scope.setContext('email', {
      from: this.from,
      toDomain: to.split('@')[1] ?? 'unknown',
    });
    Sentry.captureException(new Error(`Resend send failed: ${error.message}`));
  });
  return { success: false, error: error.message };
}
```

---

**Verify-path Sentry pattern** (analog `sms.service.ts` L454-462, 동일 패턴 재확인):

```typescript
      Sentry.withScope((scope) => {
        scope.setTag('provider', 'valkey');
        scope.setLevel('error');
        Sentry.captureException(err);
      });
      this.logger.error({ event: 'sms.verify_failed', phone: e164, err: (err as Error).message });
      return { verified: false, message: '인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.' };
```

→ **Apply to target:** email.service.ts 는 단일 실패 분기 (send error) 만 존재하므로 verify-path 는 해당 없음. 하지만 두 번째 Sentry 호출 사이트가 sms 에도 존재한다는 점은 email.service.ts 의 error branch 가 "프로젝트에서 이미 확립된 패턴의 반복" 임을 보증.

---

**Error handling 원칙 (inherited, 수정 금지)**

email.service.ts L68-69 의 명시 주석 (`Resend returns { data, error } — it does NOT throw`) 때문에 **try/catch 래퍼를 추가하면 안 된다** (RESEARCH §Anti-Pattern AP-01). Sentry 삽입은 반드시 기존 `if (error)` 분기 **내부** 에만 한정.

---

### `apps/api/src/modules/auth/email/email.service.spec.ts` (test, unit)

**Analog:** 동일 파일 L86-99 (기존 "PROD SDK error" 케이스) + `apps/api/src/modules/admin/admin-diagnostics.controller.ts` (Sentry.captureException 사용 선례).

**Role match:** vitest 기반 unit test, `vi.mock('resend')` 로 외부 SDK 모킹 후 `expect(result).toEqual(...)` 어설션. Phase 15 에서는 **Sentry 호출** 이라는 신규 side effect 를 spec 으로 검증해야 한다.

**Existing mock pattern** (기존 spec L6-14):

```typescript
vi.mock('resend', () => {
  const sendMock = vi.fn();
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: { send: sendMock },
    })),
    __sendMock: sendMock,
  };
});

import * as resendModule from 'resend';
```

→ **Apply to target:** 동일 구조로 `@sentry/nestjs` mock 을 추가. 이 프로젝트 전체에서 `@sentry/nestjs` 를 mock 하는 spec 은 아직 존재하지 않음 (`sms.service.spec.ts` 는 Sentry assert 를 하지 않음 — Grep 결과 `Sentry` 라는 단어가 주석 1 곳에만 있음). 따라서 **Sentry mock 은 신규 패턴** 이며 Phase 15 에서 처음으로 확립된다.

**Existing "PROD SDK error" 케이스** (기존 spec L86-99, 확장 대상):

```typescript
it('PROD SDK error: Resend returns { error } → returns { success: false, error }', async () => {
  const config = makeConfig({
    RESEND_API_KEY: 're_test_key',
    RESEND_FROM_EMAIL: 'no-reply@heygrabit.com',
    NODE_ENV: 'production',
  });
  const mod = resendModule as unknown as { __sendMock: ReturnType<typeof vi.fn> };
  mod.__sendMock.mockResolvedValueOnce({ data: null, error: { message: 'rate limit exceeded' } });

  const svc = new EmailService(config);
  const result = await svc.sendPasswordResetEmail('user@example.com', 'https://app.test/reset?t=abc');

  expect(result).toEqual({ success: false, error: 'rate limit exceeded' });
});
```

→ **Apply to target (신규 case 또는 기존 case 확장):** 이 케이스에 `Sentry.captureException` 호출 assert 를 추가하거나, 별도 `it('PROD SDK error: calls Sentry.captureException with resend tag + toDomain context')` 케이스를 신설.

**신규 Sentry mock 권장 구조** (프로젝트 최초 확립):

```typescript
// hoist 순서: vi.mock 은 모듈 import 이전에 hoist 되므로, resend mock 과 동일 위치에 배치.
vi.mock('@sentry/nestjs', () => {
  const captureExceptionMock = vi.fn();
  const withScopeMock = vi.fn((cb: (scope: {
    setTag: (k: string, v: string) => void;
    setLevel: (l: string) => void;
    setContext: (n: string, c: Record<string, unknown>) => void;
  }) => void) => {
    const scope = {
      setTag: vi.fn(),
      setLevel: vi.fn(),
      setContext: vi.fn(),
    };
    cb(scope);
    return scope;
  });
  return {
    captureException: captureExceptionMock,
    withScope: withScopeMock,
    __captureExceptionMock: captureExceptionMock,
    __withScopeMock: withScopeMock,
  };
});

import * as sentry from '@sentry/nestjs';
```

**Assertion 예시** (새 케이스 또는 기존 PROD SDK error 케이스에 추가):

```typescript
const sentryMod = sentry as unknown as {
  __captureExceptionMock: ReturnType<typeof vi.fn>;
  __withScopeMock: ReturnType<typeof vi.fn>;
};
expect(sentryMod.__withScopeMock).toHaveBeenCalledTimes(1);
expect(sentryMod.__captureExceptionMock).toHaveBeenCalledTimes(1);

// 첫번째 인자가 Error + message 에 Resend failure 메시지 포함.
const capturedErr = sentryMod.__captureExceptionMock.mock.calls[0]?.[0] as Error;
expect(capturedErr).toBeInstanceOf(Error);
expect(capturedErr.message).toContain('rate limit exceeded');

// withScope 콜백이 setTag('provider', 'resend') 를 호출했는지 — scope 인자를 캡처한 mock 이 필요.
// (간이 검증: withScope 호출됨만 체크하고, 정확한 tag 는 별도 스텁으로 캡처하거나 integration 으로 위임)
```

→ **Apply to target:** 기존 spec 파일의 beforeEach 에 `sentryMod.__captureExceptionMock.mockClear(); sentryMod.__withScopeMock.mockClear();` 추가해 test isolation 을 보존. 기존 `vi.clearAllMocks()` 만으로도 충분하므로 중복 시 생략 가능 (vitest `clearAllMocks` 는 모든 `vi.fn()` 을 초기화).

---

**Existing `Sentry.captureException` 직접 호출 선례** (analog `admin-diagnostics.controller.ts` L17-25) — Sentry mock 구조 설계의 참고용:

```typescript
import * as Sentry from '@sentry/nestjs';
// ...
const eventId = Sentry.captureException(new Error(marker));
```

→ 이 controller 는 Sentry 가 event ID 를 리턴한다는 SDK contract 에 의존. Email spec 에서는 event ID 까지 assert 할 필요는 없음 (mock 의 return 값은 undefined 로 두어도 무방 — email.service.ts 는 `Sentry.captureException` 의 return 값을 사용하지 않는다).

---

### `15-HUMAN-UAT.md` (new, operational audit log)

**Analog:** `.planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/14-HUMAN-UAT.md`
**Role match:** 같은 "production cutover + 관측창" 성격. Phase 14 의 D-17 72h Sentry window 는 Phase 15 에서는 "72h deliverability 관측 + DMARC aggregate report 수집" 형태로 변주 가능.

**Section skeleton to replicate** (14-HUMAN-UAT L1-16):

```markdown
# Phase 15 HUMAN-UAT — Resend heygrabit.com cutover

**Created:** 2026-04-24
**Goal:** (Phase 14 L4 문법 그대로) 프로덕션 transactional email 경로가 `heygrabit.com` 로 cutover 되고 3사 inbox 수신이 검증됨.

**Pre-conditions:**
- [ ] Plan 01 merged (email.service.ts Sentry.captureException 삽입 + spec 통과)
- [ ] `pnpm --filter @grabit/api test` 전체 green
- [ ] GitHub Actions deploy.yml → Cloud Run `grabit-api` 새 revision 이 ACTIVE
- [ ] Resend 대시보드에서 heygrabit.com 이 Verified 상태 (CONTEXT D-08 게이트)
```

**SC-XX 시나리오 구조** (14-HUMAN-UAT L19-38 참조):

```markdown
## SC-1: 프로덕션 3사 inbox 수신 검증 (LOCKED D-14)

**Steps:**
1. https://heygrabit.com/auth/forgot-password 접속
2. 수신 메일 주소 입력 (차례로 Gmail → Naver → Daum)
3. "비밀번호 재설정 링크 받기" 클릭
4. 각 inbox 에서 `[Grabit] 비밀번호 재설정` / from `no-reply@heygrabit.com` 수신 확인 (spam 폴더 아님)

**Expected:** 3 사 모두 inbox (not spam) 수신, from header 가 `no-reply@heygrabit.com`, SPF/DKIM alignment pass (Gmail "자세히 보기" 헤더).

**체크리스트:**
- [ ] Gmail inbox 수신 시각: __________
- [ ] Naver inbox 수신 시각: __________
- [ ] Daum inbox 수신 시각: __________
- [ ] 한 곳이라도 spam → DKIM/SPF alignment 재검토
```

**D-16 운영 로그 필드** (14-HUMAN-UAT L50-59 의 fill-in-blank 패턴 계승):

```markdown
## Operational Audit Log (CONTEXT D-16)

- Resend 대시보드 heygrabit.com Verified 전환 시각: __________ (ISO8601)
- 후이즈 DNS 등록 시각: __________
  - `dig +short TXT send.heygrabit.com` 결과: __________
  - `dig +short TXT resend._domainkey.heygrabit.com` 결과: __________
  - `dig +short TXT _dmarc.heygrabit.com` 결과: __________
- Secret Manager 신규 version 번호: __________ (e.g., versions/3)
- 신규 Cloud Run revision ID: __________ (`grabit-api-000XX-xxx`)
- 100% traffic 도달 시각: __________
- 3 사 UAT 수신 시각: (SC-1 참조)
- Resend 구 grapit.com 도메인 제거 시각 (D-02, UAT 통과 이후): __________
```

**Sign-off 섹션** (14-HUMAN-UAT L76-84 동일 구조):

```markdown
## Sign-off

- [ ] SC-1 체크리스트 PASS (3사 inbox)
- [ ] Sentry `grabit-api` 프로젝트에서 새 revision 이후 `component:email-service` 이벤트 0 건 (D-13 정합)
- [ ] `gcloud logging read '... "Resend send failed" ...' --freshness=24h` empty
- [ ] 검증자: __________
- [ ] 완료 날짜: __________
- [ ] `.planning/STATE.md` Phase 15 상태 "shipped (code+prod UAT)" 로 업데이트
```

**Rollback 기준 섹션** (14-HUMAN-UAT L88-90 패턴, D-15 내용으로 대체):

```markdown
**Rollback 기준:**
- 3사 중 2개 이상이 spam 분류 또는 미수신 → 즉시 Secret version 이전 pin:
  `gcloud run services update grabit-api --region=asia-northeast3 \
       --update-secrets RESEND_FROM_EMAIL=resend-from-email:<prev_version>`
- `Resend send failed` 로그가 배포 직후 1시간 내 5건 이상 → 동일 rollback
- DNS revert 는 propagation 지연으로 rollback 수단이 아님 (D-15)
```

---

## Shared Patterns

### Sentry namespace import
**Source:**
- `apps/api/src/instrument.ts:1` — `import * as Sentry from '@sentry/nestjs';`
- `apps/api/src/modules/sms/sms.service.ts:6` — 동일
- `apps/api/src/common/filters/http-exception.filter.ts:7` — 동일
- `apps/api/src/modules/admin/admin-diagnostics.controller.ts:2` — 동일

**Apply to:** email.service.ts 에 동일한 `import * as Sentry from '@sentry/nestjs';` 한 줄 추가. default import 또는 named import 를 쓰지 말 것 — 프로젝트 전반 4 곳이 모두 namespace import.

---

### `Sentry.withScope + setTag/setLevel + captureException` 호출 순서
**Source:** `apps/api/src/modules/sms/sms.service.ts` L321-329 (send) + L455-459 (verify)

```typescript
Sentry.withScope((scope) => {
  scope.setTag('provider', '<name>');
  // 선택적 context-specific tag 들 추가
  scope.setLevel('error');
  Sentry.captureException(err);
});
this.logger.error({ event: '...', ... });
```

**Apply to:** email.service.ts L77-80. 순서 — (1) `withScope` 콜백 내부에서 `setTag` 들 호출 → (2) `setLevel('error')` → (3) `Sentry.captureException(…)`. 이 블록은 기존 `logger.error` **직후**에 삽입 (CONTEXT D-11 "바로 다음 줄"). 순서를 뒤집지 말 것 (logger 가 먼저, Sentry 가 나중) — sms 는 반대로 Sentry 가 먼저인데, D-11 이 explicit 하게 logger.error 가 먼저 있는 전제로 "다음 줄" 지시이므로 D-11 을 우선.

---

### 전역 vs service-level Sentry capture 경계
**Source:** `apps/api/src/common/filters/http-exception.filter.ts:18-20`

```typescript
if (status >= 500) {
  Sentry.captureException(exception);
}
```

**Apply to:** email.service.ts 의 Sentry 호출은 **service-level** 이며 HttpException 을 throw 하지 않는다 (D-12 enumeration 방어). 따라서 http-exception.filter.ts 전역 필터와 **경합 없음** — silent return 경로를 위한 독립 capture. Plan 에서 "이미 전역 필터가 있는데 왜 service-level 로 다시 captureException 하냐" 질문이 나올 수 있으므로 rationale 을 Plan comment 또는 spec 주석으로 남기는 것을 권장 (예: `// service-level capture is required because auth.service.ts:250 intentionally swallows the return value for enumeration defense; http-exception.filter.ts never sees the failure.`).

---

### PII masking in Sentry context
**Source:** `apps/api/src/modules/sms/sms.service.ts:320` — `const country = e164.startsWith('+82') ? 'KR' : 'unknown';`

**Apply to:** email.service.ts 의 `to` 이메일 주소를 full string 으로 Sentry 에 전달하지 말 것. domain 부분만 기록:

```typescript
scope.setContext('email', {
  from: this.from,
  toDomain: to.split('@')[1] ?? 'unknown',
});
```

`this.from` 은 운영자가 의도적으로 세팅한 env 값이므로 PII 아님 — 전체 기록 OK.

---

### NestJS service error-branch 원칙 (inherited, don't break)
**Source:** `apps/api/src/modules/auth/email/email.service.ts:68-69`

```typescript
// Resend returns { data, error } — it does NOT throw (RESEARCH §Pitfall 2).
// Do not wrap in try/catch; branch on `error` instead.
```

**Apply to:** email.service.ts 수정 시 **try/catch 를 새로 추가하지 말 것** (RESEARCH AP-01). Sentry 삽입은 반드시 기존 `if (error)` 분기 내부에 한정.

---

## No Analog Found — Operational Tasks (Plan runbook 으로 이관)

다음 작업들은 코드 파일이 아니므로 PATTERNS.md 범위 밖. Plan 의 task action 에서 직접 `gcloud` / `dig` / UI click-through 지시로 기술해야 함.

| Operational Task | Why no code analog | Reference |
|---|---|---|
| Resend 콘솔에서 heygrabit.com 도메인 추가 | UI 조작, Resend API 호출 없음 | RESEARCH §Pitfall 1 — 대시보드 값 그대로 후이즈에 등록 |
| 후이즈 DNS 에 SPF/DKIM/DMARC 레코드 등록 | 제3자 DNS UI, code path 없음 | CONTEXT D-03 ~ D-06 (단, 리터럴 값은 Resend 발급값 우선) |
| `gcloud secrets versions add resend-from-email` | GCP CLI, repo 내 IaC 파일 없음 | RESEARCH §Pattern 2 L211-227 (stdin pipe 권장: `printf '...' \| gcloud secrets versions add ... --data-file=-`) |
| `gcloud run services update --update-secrets` | GCP CLI, deploy.yml 경로와 독립 | CONTEXT D-09 + RESEARCH §Pattern 2 revision semantics |
| `gcloud run services describe` traffic 확인 | GCP CLI read-only | CONTEXT D-10 |
| `gcloud logging read '... Resend send failed ...' --freshness=24h` | GCP CLI read-only | CONTEXT D-13 |
| Resend 대시보드에서 구 grapit.com 도메인 제거 | UI 조작, UAT 통과 후 | CONTEXT D-02, AP-05 |

Plan 이 이 runbook 부분을 작성할 때 참조할 selector:
- GCP project: `grapit-491806` (CONTEXT + HANDOFF 고정)
- Region: `asia-northeast3` (CLAUDE.md + HANDOFF)
- Secret name: `resend-from-email`
- Env binding 이름: `RESEND_FROM_EMAIL` (deploy.yml L118-124)
- Cloud Run service: `grabit-api`

---

## Metadata

**Analog search scope:**
- `apps/api/src/modules/sms/` (send-failure Sentry 선례)
- `apps/api/src/modules/admin/` (Sentry.captureException 직접 호출 선례)
- `apps/api/src/common/filters/` (전역 Sentry capture 경계 구분)
- `apps/api/src/instrument.ts` (Sentry.init — email.service.ts 는 이미 자동 계승)
- `apps/api/src/modules/auth/email/` (수정 대상 + 기존 spec 구조)
- `.planning/phases/13-*/HANDOFF.md` (HUMAN-UAT 형식 참조 후보 1)
- `.planning/phases/14-*/14-HUMAN-UAT.md` (HUMAN-UAT 형식 참조 후보 2, 최종 선정)

**Files scanned:** 7 code files + 2 planning docs

**Key patterns identified:**
1. `Sentry.withScope(scope => { setTag; setLevel; }); Sentry.captureException(err);` — 프로젝트 전반 확립된 observability 패턴 (sms.service.ts 두 호출 사이트 + email 신규 호출 사이트)
2. `import * as Sentry from '@sentry/nestjs';` namespace import — 4/4 기존 호출 사이트에서 동일
3. PII masking in Sentry context (phone→country, email→toDomain) — 운영 신원 감쇠 규약
4. HUMAN-UAT 파일 = Pre-conditions + SC-XX 시나리오 (Steps/Expected/체크리스트) + Operational Audit Log (fill-in-blank 필드) + Sign-off + Rollback 기준 의 5 섹션 블록 (Phase 14 에서 확립, Phase 15 계승)

**Pattern extraction date:** 2026-04-24

---

## PATTERN MAPPING COMPLETE

**Phase:** 15 - Resend heygrabit.com cutover
**Files classified:** 3 (code) + 1 (operational doc) = 4
**Analogs found:** 3 / 3 code files (100%), 1 / 1 operational doc (100%)

### Coverage
- Files with exact analog: 3 (email.service.ts ↔ sms.service.ts send block; email.service.spec.ts ↔ 동일 파일 기존 케이스; 15-HUMAN-UAT.md ↔ 14-HUMAN-UAT.md)
- Files with role-match analog: 1 (email.service.spec.ts Sentry mock 은 프로젝트 최초 확립 — 패턴은 기존 resend mock 구조 계승)
- Files with no analog: 0 (코드), 6 operational tasks (gcloud/dig/UI — 의도적으로 Plan runbook 으로 이관)

### Key Patterns Identified
- `Sentry.withScope + setTag + setLevel + captureException` 4-step 블록 (sms.service.ts L321-329 표준)
- namespace import `import * as Sentry from '@sentry/nestjs';` (프로젝트 4/4 동일)
- service-level Sentry capture (silent return 경로) ↔ 전역 http-exception.filter.ts (throw 경로) 경계 명확화
- PII masking: full identifier 대신 `country` / `toDomain` 만 scope context 에 기록
- HUMAN-UAT: Pre-conditions + SC 시나리오 + Audit Log + Sign-off + Rollback 5 섹션 템플릿

### File Created
`.planning/phases/15-resend-heygrabit-com-cutover-transactional-email-secret-mana/15-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner 는 이 문서의 "Apply to target" 블록을 Plan 의 action step 에 직접 인용할 수 있다. 운영 작업(6 items) 은 Plan 의 별도 runbook 섹션으로 작성 — PATTERNS.md 범위 밖.
