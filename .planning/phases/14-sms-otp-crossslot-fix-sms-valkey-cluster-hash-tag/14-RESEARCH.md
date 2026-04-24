# Phase 14: SMS OTP CROSSSLOT fix — 프로덕션 회원가입 SMS 인증 정상화 (Valkey Cluster hash tag 적용) - Research

**Researched:** 2026-04-24
**Domain:** Valkey/Redis Cluster hash-tag protocol · ioredis · testcontainers cluster-mode 하네스 · Next.js client-component UX
**Confidence:** HIGH (root-cause + hash-tag spec + CROSSSLOT wire-format) / MEDIUM (테스트 토폴로지 선택 — 비교표 기반 권고)

## TL;DR

1. **수정 자체는 booking.service.ts 패턴 그대로 답습**: 3개 키를 `{sms:${e164}}:otp|attempts|verified` 로 래핑하면 CRC16 이 동일 slot (≤ 16383) 에 매핑되어 CROSSSLOT 이 영구 제거된다 — 이 부분은 [VERIFIED: Redis Cluster Spec 의 HASH_SLOT 알고리즘](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/) 으로 수학적으로 증명 가능.
2. **회귀 가드(이번 phase 2차 deliverable) 의 핵심 권고는 "testcontainer 로 단일 `valkey/valkey:8` 컨테이너를 `--cluster-enabled yes` 로 기동하고 `CLUSTER ADDSLOTS` 로 16384 slot 모두 자기 자신에게 할당" 한 1-master-0-replica single-shard cluster.** Memorystore for Valkey shard-count=1 과 동형이고, 외부 이미지 의존 없이 이미 사용 중인 `valkey/valkey:8` 이미지로 완결된다. 대안(fallback)은 `oliver006/valkey-cluster:latest` 3-master out-of-box.
3. 단일 `new IORedis(url)` 클라이언트는 Memorystore CME endpoint 에 붙어도 **CROSSSLOT/MOVED reply 를 서버가 그대로 돌려준다** ([CITED: GCP Memorystore connect-instance](https://docs.cloud.google.com/memorystore/docs/valkey/connect-instance)). 프로덕션 클라이언트는 그대로 두고, 테스트에서만 최소 옵션으로 `new IORedis.Cluster([{host,port}], { natMap, lazyConnect:true })` 를 써서 보조 검증을 한다.
4. CROSSSLOT 에러 텍스트는 `CROSSSLOT Keys in request don't hash to the same slot` 로 고정된 wire-format — `expect(...).rejects.toThrow(/CROSSSLOT/)` 패턴으로 assertion 가능.
5. 프론트 수정(`phone-verification.tsx`)은 **Vitest + @testing-library/react 단위 테스트 1개로 충분** — server `message` 우선 / fallback 분기만 검증하면 SC-4 충족. Playwright 는 기존 signup E2E 에 `intercept` 로 400 reply 를 주입하는 식으로 덧붙일 수도 있으나 필수는 아님.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**[LOCKED] Valkey 키 스킴 (hash tag 규격)**

- **D-01** 3개 SMS OTP 키의 공통 hash tag 로 전화번호(e164) 를 사용한다. 최종 키 형태:
  - `{sms:${e164}}:otp`
  - `{sms:${e164}}:attempts`
  - `{sms:${e164}}:verified`
- **D-02** Hash tag 형식은 booking 의 `b382e39` 패턴을 그대로 승계: `{<common>}:<role>`. 기존 `sms:otp:${e164}` → `{sms:${e164}}:otp` 로 순서가 바뀌어 **모든 write/read 호출부와 Lua `VERIFY_AND_INCREMENT_LUA` 호출 시 전달하는 KEYS[1..3] 인자도 동기화 필수**. 병행 운영하지 않는다(브리지 없이 한 번에 전환).
- **D-03** 이전 스킴(`sms:otp:${e164}` 등)은 TTL 이 짧아 즉시 폐기한다 (otp 180s / attempts 900s / verified 600s).
- **D-04** rate-limit 키(`sms:phone:send:${e164}`, `sms:phone:verify:${e164}`, `sms:cooldown:${e164}`) 는 **이번 phase 에서 건드리지 않는다**.

**[LOCKED] Lua 스크립트**

- **D-05** `VERIFY_AND_INCREMENT_LUA` 본체는 수정하지 않는다. docstring 만 갱신.
- **D-06** `ATOMIC_INCR_LUA` 역시 변경 금지(단일 key 동작).

**[LOCKED] 프론트엔드 UX — server message 우선**

- **D-07** `handleVerifyCode` 는 `res.verified === false` 일 때 `res.message` 가 존재하면 그 값을 `setVerifyError` 에 사용하고, 없을 때만 기존 하드코드 "인증번호가 일치하지 않습니다" 로 fallback.
- **D-08** `VerifyResult.message` 는 `string | undefined`; 빈 문자열 방어: `typeof res.message === 'string' && res.message.length > 0`.
- **D-09** 기존 catch 분기(`ApiClientError` 410/422 → 만료 상태) 는 유지.

**[LOCKED] 회귀 가드 — cluster-mode 통합 테스트**

- **D-10** 회귀 테스트는 "cluster-mode 인 Valkey 위에서 `VERIFY_AND_INCREMENT_LUA` 를 새 key 스킴으로 EVAL 했을 때 CROSSSLOT 이 나지 않는다" 를 검증. 역도 필요: 과거 스킴 = CROSSSLOT fail.
- **D-12** CI 에 들어가야 한다.

**[LOCKED] 백엔드 에러 의미 구분**

- **D-14** `SmsService.verifyCode` 의 generic catch(L390-415) 는 변경하지 않는다.
- **D-15** catch 안의 `sms:phone:verify:${e164}` counter 롤백은 새 hash tag 스킴 적용 대상 아님.

**[LOCKED] 관측성**

- **D-16** `sms.service.ts` 의 기존 Sentry/logger 스코프는 유지.
- **D-17** 배포 후 72시간 Sentry `sms.verify_failed` × `CROSSSLOT` 키워드 수동 모니터링 HUMAN-UAT.

**[LOCKED] 범위 가드**

- **D-18** 단일 목표: "프로덕션 회원가입 SMS OTP 인증이 정상 성공한다".
- **D-19** 마이그레이션 스크립트/플래그 없이 한 번에 배포. 15분 drain 창은 HUMAN-UAT 에 명시.

**[LOCKED] 검증 & UAT 계약**

- **D-20 Success Criteria (SC-1..SC-4)**:
  - SC-1 프로덕션 `https://heygrabit.com` 에서 실기기 회원가입 SMS 인증 성공.
  - SC-2 cluster-mode Valkey 통합 테스트: 과거 스킴 = CROSSSLOT fail, 신규 스킴 = pass.
  - SC-3 `apps/api/test/sms-throttle.integration.spec.ts` 녹색 + 전체 `pnpm --filter @grabit/api test` 녹색.
  - SC-4 `phone-verification.tsx` 서버 message 우선 표시 — 유닛/Playwright 레벨 확인.
- **D-21** HUMAN-UAT 는 Phase 13 UAT gap 10 의 원래 failure 시나리오 재현 포함.

### Claude's Discretion

- **D-11** cluster-mode Valkey 테스트 토폴로지의 정확한 이미지/설정 — research 에서 권고안 확정 대상.
- **D-13** `sms.lua.ts` 모듈 도입 여부 — `sms.service.ts` 에서 상수 export 만으로 충분하면 그 선에서 멈춰도 됨.
- 프론트엔드 server-message 적용 범위 — `phone-verification.tsx` 외 다른 consumer 있으면 함께 적용.
- 통합 테스트 파일 위치 — 기존 파일 확장 vs 신규 `sms-cluster-crossslot.integration.spec.ts` 분리.

### Deferred Ideas (OUT OF SCOPE)

- WR-02 long-term: SMS verify 성공 시 opaque bound token 발급 (별도 phase).
- `email.service.ts` silent `{success:false}` Sentry 캡처 → Phase 15.
- `/legal/*` 페이지 신설 → Phase 16.
- Local dev `/health` 503 (InMemoryRedis.ping 부재) → Phase 17.
- SMS 발송 경로 rollback observability 추가 개선 → 후속 backlog.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | 프로덕션 `https://heygrabit.com` 실기기 회원가입 SMS OTP 인증 성공 | §1(hash-tag 수학적 증명) + §3(배포 drain 프로파일) + §8(HUMAN-UAT 체크리스트) |
| SC-2 | cluster-mode Valkey 통합 테스트: 과거 스킴 CROSSSLOT, 신규 스킴 pass | §4(토폴로지 비교표) + §5(CROSSSLOT wire-format assertion) + §6(ioredis.Cluster 최소 옵션) + §9(회귀 가드 시나리오 목록) |
| SC-3 | 기존 throttler/Lua smoke 테스트 + 전체 API suite 녹색 | §7(기존 테스트와 중복·공백 매트릭스) — 키 상수 드리프트 방지 가이드 |
| SC-4 | `phone-verification.tsx` server message 우선 표시 | §2(server-message 계약 + 공격 모델 검토) + §10(프론트 테스트 범위 권고) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| 제약 | 출처 | 이번 phase 적용 |
|-----|------|-----------------|
| ES modules only (no CommonJS require) | `~/.claude/CLAUDE.md` | testcontainers 하네스, 새 `sms.lua.ts` (도입 시) 모두 `import` 만 사용 |
| Strict typing — no `any`, no untyped | `~/.claude/CLAUDE.md` | eval 반환값 `[string, number]` tuple 으로 명시, 새 integration spec 은 `Chain` / `StartedTestContainer` 타입을 유지 |
| typecheck + lint after code changes | `~/.claude/CLAUDE.md` | 배포 전 `pnpm --filter @grabit/api typecheck` + `lint` 필수 |
| Write tests before implementation for business logic | `~/.claude/CLAUDE.md` | 회귀 가드 통합 테스트 = 실제 구현 변경 전에 "과거 스킴 CROSSSLOT" 확인하는 테스트부터 추가 권고 |
| Korean 으로 응답 | `~/.claude/CLAUDE.md` | PLAN / plan task description 은 한국어 |
| No Co-Authored-By trailers, conventional commits | `~/.claude/CLAUDE.md` | `fix(sms): add Redis Cluster hash tags to prevent CROSSSLOT errors` 스타일 |
| 모노레포 루트 `.env` / drizzle-kit `DOTENV_CONFIG_PATH` | `./CLAUDE.md` | 이번 phase 는 DB schema 변경 없음 — 무관 |
| 개발 포트 web 3000 / api 8080 | `./CLAUDE.md` | 통합 테스트는 testcontainer 랜덤 포트 사용 — 충돌 없음 |
| Valkey Cluster 는 OUT OF SCOPE (v1.1 REQUIREMENTS 의 "Out of Scope" 테이블) | `.planning/REQUIREMENTS.md` L88 | **이 phase 는 Valkey Cluster 전환이 아니라 "이미 cluster-mode 인 Memorystore 에서의 CROSSSLOT 수정" 임을 명확히 — 실제로 단일 shard 이고 운영상 cluster 전환은 여전히 out of scope** |

## Summary

Memorystore for Valkey 는 shard-count=1 이라도 **Cluster Mode Enabled(CME) 토폴로지로 운영**되며, 서버가 multi-key EVAL 에 CROSSSLOT protocol 을 강제한다 ([CITED: GCP Memorystore cluster-mode doc](https://docs.cloud.google.com/memorystore/docs/valkey/cluster-mode-enabled-and-disabled)). Debug session 이 이미 root cause 를 확정했고, 수정 방향(hash-tag + 프론트 server-message 우선)도 locked 되어 있다. 이번 research 의 가치 밀집 지점은 **D-11 cluster-mode 통합 테스트 토폴로지의 선택** 이다.

핵심 결론은 "OSS Valkey 는 공식적으로 3-master 이상을 `create-cluster` 의 최소 구성으로 요구" ([CITED: Valkey cluster tutorial](https://valkey.io/topics/cluster-tutorial/)) 하지만, **`valkey-cli --cluster create` 대신 `CLUSTER ADDSLOTS 0 .. 16383` 로 단일 master 에 모든 slot 을 수동 할당하면 single-node 도 CROSSSLOT 을 정상적으로 enforce 한다** ([CITED: Redis CLUSTER ADDSLOTS](https://redis.io/commands/cluster-addslots/), [VERIFIED: redis/redis#5118 "CROSSSLOT error on single-shard cluster"](https://github.com/redis/redis/issues/5118) 가 single-shard 에서도 enforcement 가 동작함을 bug report 차원에서 확증). 이 구성은 프로덕션 Memorystore shard-count=1 과 토폴로지적으로 동형이고, 이미 project 가 사용 중인 `valkey/valkey:8` 이미지만 재사용 가능하다. 외부 이미지 의존을 줄이고 재현 환경 = 프로덕션 환경인 것이 가장 큰 장점.

Primary 권고: **Option A — 단일 `valkey/valkey:8` 컨테이너 + `CLUSTER ADDSLOTS` 수동 init**. Fallback: `oliver006/valkey-cluster:latest` 3-master-3-replica out-of-box (v9.0.1, 2026-01 update — [CITED: oliver006/docker-valkey-cluster](https://github.com/oliver006/docker-valkey-cluster)).

**Primary recommendation:**
1. `sms.service.ts` 에서 3개 키의 빌더 함수(`smsOtpKey`, `smsAttemptsKey`, `smsVerifiedKey`)를 `export` 하고, Lua 상수(`VERIFY_AND_INCREMENT_LUA`)도 `export`. 테스트가 서비스 파일에서 직접 import 하도록 해 D-13 drift 를 구조적으로 차단.
2. 신규 파일 `apps/api/test/sms-cluster-crossslot.integration.spec.ts` 를 추가: `valkey/valkey:8` 을 `--cluster-enabled yes --cluster-config-file nodes.conf` 로 기동 → `CLUSTER ADDSLOTS 0..16383` 수동 할당 → `new IORedis.Cluster([{host, port}], { natMap, lazyConnect: true })` 로 연결 → (i) 과거 스킴 EVAL → `/CROSSSLOT/` reject, (ii) 신규 스킴 EVAL → 4 결과 분기 모두 pass, (iii) 새 키 이름이 hash 동일 slot 증명 (`CLUSTER KEYSLOT` 3개 비교).
3. `phone-verification.tsx` 수정 + Vitest 단위 테스트 1개 (server message 우선 / fallback 분기).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OTP 저장/대조 Lua 스크립트 실행 | API (`apps/api/src/modules/sms`) | Valkey (storage) | Lua EVAL 은 API 가 소유 — Valkey 는 순수 datastore |
| OTP 키 네임스페이스 정의 | API (`sms.service.ts`) | — | 클라이언트(web) 는 phone 만 전달하고 키 계산에 관여하지 않음 |
| 시스템 에러 vs 틀린 OTP 구분 UX | Frontend client component (`phone-verification.tsx`) | API (`VerifyResult.message` shape) | D-07 계약: 서버가 message 를 내리고, 클라이언트가 이를 우선 사용 |
| CROSSSLOT 회귀 가드 | Test (`apps/api/test/…`) + CI (`.github/workflows`) | — | Vitest integration + testcontainers 로 cluster-mode 재현 |
| 프로덕션 관측성 (Sentry tag) | API (기존 `sentry/nestjs` 스코프) | — | D-16 범위 — 코드 변경 없음 |

## Standard Stack

### Core (이미 프로젝트에 설치됨 — 추가 설치 없음)

| Library | Installed Version | Purpose | Why Standard | 확신도 |
|---------|-------------------|---------|--------------|--------|
| ioredis | 5.10.1 (`apps/api/package.json`) | Valkey/Redis client (TCP) | 이미 프로덕션 single-client 로 사용 중; `IORedis.Cluster` 클래스가 같은 패키지에 포함 | HIGH |
| testcontainers | 11.14.0 (`apps/api/package.json` devDeps) | Docker 기반 통합 테스트 하네스 | `sms-throttle.integration.spec.ts` 에서 이미 `GenericContainer('valkey/valkey:8')` 로 사용 — 패턴 재사용 | HIGH |
| vitest | 3.2.0 (`apps/api/package.json` + `apps/web/package.json`) | 테스트 러너 | API/web 양쪽에 이미 설치 — `@testing-library/react` 도 web 에 있음 | HIGH |
| @testing-library/react | 16.3.0 (`apps/web/package.json`) | 컴포넌트 테스트 | `phone-verification.tsx` 단위 테스트용 | HIGH |

### Supporting — 신규 도입 없음

이번 phase 는 신규 dependency 를 추가하지 않는다. `valkey/valkey:8` 이미지를 cluster 모드로 기동하는 것은 기존 `GenericContainer` API 의 `.withCommand([...])` 만으로 가능 ([CITED: testcontainers-node GenericContainer API](https://node.testcontainers.org/)).

### Alternatives Considered (cluster 테스트 이미지)

§4 의 "Cluster-mode 테스트 토폴로지 비교표" 참고.

## Architecture Patterns

### System Data Flow (변경 전후 동일 — 키 이름만 변경)

```
[web/signup-step3] --(POST /api/v1/sms/send-code)--> [api/sms.controller]
                                                        |
                                                        v
                                                  [SmsService.sendVerificationCode]
                                                        |
                                                        +--> parseE164(phone) = e164
                                                        +--> pipeline:
                                                        |     SET {sms:${e164}}:otp  otp PX 180000   (was: sms:otp:${e164})
                                                        |     DEL {sms:${e164}}:attempts                (was: sms:attempts:${e164})
                                                        +--> infobip.sendSms(e164, text)

[web/signup-step3] --(POST /api/v1/sms/verify-code)--> [api/sms.controller]
                                                        |
                                                        v
                                                  [SmsService.verifyCode]
                                                        |
                                                        +--> atomicIncr(sms:phone:verify:${e164}, 900)   ← unchanged
                                                        +--> redis.eval(VERIFY_AND_INCREMENT_LUA, 3,
                                                        |       {sms:${e164}}:otp,                       ← hash-tagged
                                                        |       {sms:${e164}}:attempts,                  ← hash-tagged
                                                        |       {sms:${e164}}:verified,                  ← hash-tagged
                                                        |       code, '5', '600')
                                                        |     └─ Valkey CRC16("sms:+821012345678") → single slot
                                                        |        → same slot for all 3 keys → NO CROSSSLOT
                                                        +--> switch on status:
                                                              VERIFIED         → return {verified:true}
                                                              WRONG            → return {verified:false, message:'인증번호가 일치하지 않습니다'}
                                                              EXPIRED          → throw GoneException(410)
                                                              NO_MORE_ATTEMPTS → throw GoneException(410)
                                                        |
                                                        +--> catch(err)  ← unchanged (D-14)
                                                              ├─ if GoneException: re-throw
                                                              ├─ rollback verify counter (WR-04)
                                                              ├─ Sentry.captureException
                                                              └─ return {verified:false, message:'인증번호 확인에 실패했습니다...'}

                                                        ↓ HTTP 200 JSON
[web phone-verification.tsx handleVerifyCode]
    ← res.verified === true  → onVerified(code) + clearTimer
    ← res.verified === false →
          OLD: setVerifyError('인증번호가 일치하지 않습니다')  (하드코드)
          NEW: setVerifyError(res.message ?? '인증번호가 일치하지 않습니다')
```

### Recommended Project Structure (최소 변화)

```
apps/api/src/modules/sms/
├── sms.service.ts            # 키 빌더 + Lua 상수 export (D-13 권고)
├── sms.controller.ts         # 변경 없음
├── sms.module.ts             # 변경 없음
└── phone.util.ts             # 변경 없음

apps/api/test/
├── sms-throttle.integration.spec.ts          # Lua smoke 블록의 키 리터럴만 서비스 import 로 교체
└── sms-cluster-crossslot.integration.spec.ts # NEW — cluster-mode 회귀 가드

apps/web/components/auth/
├── phone-verification.tsx                     # handleVerifyCode 3줄 수정
└── phone-verification.test.tsx                # NEW — server message 우선 검증 (Vitest + @testing-library/react)
```

### Pattern 1: Hash-Tag 키 빌더 함수 export (D-13 권고)

**What:** `sms.service.ts` 에서 키 빌더를 모듈 top-level 로 승격해 test 가 import.
**When to use:** Lua 가 KEYS[] 로 받는 3개 키가 여러 파일(서비스 + 통합 테스트)에서 재정의되면 drift 가 필연.

```typescript
// apps/api/src/modules/sms/sms.service.ts (excerpt, proposed)
// [VERIFIED: booking.service.ts L127-130 equivalent pattern]
export const smsOtpKey      = (e164: string): string => `{sms:${e164}}:otp`;
export const smsAttemptsKey = (e164: string): string => `{sms:${e164}}:attempts`;
export const smsVerifiedKey = (e164: string): string => `{sms:${e164}}:verified`;

export const VERIFY_AND_INCREMENT_LUA = `
-- ... (body unchanged, D-05)
-- KEYS[1] {sms:${'${e164}'}}:otp       -- hash-tagged for Redis Cluster (Memorystore for Valkey shard=1)
-- KEYS[2] {sms:${'${e164}'}}:attempts
-- KEYS[3] {sms:${'${e164}'}}:verified
`;
```

**호출부 변경(sms.service.ts):**
```typescript
// BEFORE (L220-222, L363-365)
pipeline.set(`sms:otp:${e164}`, otp, 'PX', OTP_TTL_MS);
pipeline.del(`sms:attempts:${e164}`);
// ...
`sms:otp:${e164}`, `sms:attempts:${e164}`, `sms:verified:${e164}`,

// AFTER
pipeline.set(smsOtpKey(e164), otp, 'PX', OTP_TTL_MS);
pipeline.del(smsAttemptsKey(e164));
// ...
smsOtpKey(e164), smsAttemptsKey(e164), smsVerifiedKey(e164),
```

### Pattern 2: Cluster-mode testcontainer 부트스트랩 (single-shard)

**What:** 단일 `valkey/valkey:8` 컨테이너를 cluster 모드로 띄우고 `CLUSTER ADDSLOTS` 로 self-assign.
**When to use:** Memorystore for Valkey shard-count=1 과 동형 환경을 만들 때.

```typescript
// apps/api/test/sms-cluster-crossslot.integration.spec.ts (proposed skeleton)
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import IORedis, { Cluster } from 'ioredis';
import {
  VERIFY_AND_INCREMENT_LUA,
  smsOtpKey, smsAttemptsKey, smsVerifiedKey,
} from '../src/modules/sms/sms.service.js';

let container: StartedTestContainer;
let cluster: Cluster;

beforeAll(async () => {
  // [VERIFIED: Valkey cluster tutorial — cluster-enabled yes + cluster-node-timeout]
  container = await new GenericContainer('valkey/valkey:8')
    .withExposedPorts(6379)
    .withCommand([
      'valkey-server',
      '--port', '6379',
      '--cluster-enabled', 'yes',
      '--cluster-config-file', 'nodes.conf',
      '--cluster-node-timeout', '5000',
      '--appendonly', 'no',
      '--cluster-require-full-coverage', 'no',
    ])
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(6379);

  // Bootstrap cluster: assign all 16384 slots to this single master.
  // [VERIFIED: redis CLUSTER ADDSLOTSRANGE command]
  const boot = new IORedis(`redis://${host}:${port}`, { maxRetriesPerRequest: 3 });
  await boot.call('CLUSTER', 'ADDSLOTSRANGE', '0', '16383');
  // Wait until cluster_state:ok
  for (let i = 0; i < 20; i++) {
    const info = (await boot.call('CLUSTER', 'INFO')) as string;
    if (info.includes('cluster_state:ok')) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  await boot.quit();

  // Cluster-aware client — minimal options for single-node cluster in container
  cluster = new IORedis.Cluster(
    [{ host, port }],
    {
      // testcontainers maps 6379 → random host port; cluster slot info returns
      // internal port 6379, so natMap rewrites to the mapped host port.
      natMap: { [`${host}:6379`]: { host, port } },
      lazyConnect: true,
      scaleReads: 'master',
      enableReadyCheck: true,
      redisOptions: { maxRetriesPerRequest: 3 },
    },
  );
  await cluster.connect();
}, 180_000);

afterAll(async () => {
  await cluster?.quit();
  await container?.stop();
});
```

### Anti-Patterns to Avoid

- **`new IORedis(url)` 로만 cluster endpoint 에 붙이고 CROSSSLOT 검증을 시도** — Memorystore 에서는 동작하지만, testcontainer 로 띄운 `--cluster-enabled yes` 단일 노드는 client 가 cluster protocol 을 이해하지 못해 MOVED/ASK redirection 을 그대로 error 로 받는다. 테스트에서는 `IORedis.Cluster` 를 써야 한다.
- **테스트 파일 안에 `VERIFY_AND_INCREMENT_LUA` 를 문자열로 다시 복사** — `sms-throttle.integration.spec.ts` L286-310 가 정확히 이 anti-pattern. 이번 phase 의 D-13 권고가 이걸 제거한다.
- **하드코드된 fallback 문자열을 제거하고 `res.message` 만 사용** — D-07/D-08 은 빈 message 방어가 필수라고 명시. 무조건 fallback 유지.
- **`sms.lua.ts` 로 파일 분리를 강제** — D-13 Claude's Discretion. 현재 Lua 상수 2개는 `sms.service.ts` 에서만 사용되므로 `export const` 만으로 충분. 새 파일은 discretion 단계에서 불필요한 복잡도.
- **통합 테스트에서 3-master cluster 이미지(oliver006/valkey-cluster)로 detectively 전환** — Memorystore shard=1 과 동형성이 깨져 "single-shard 에서도 CROSSSLOT 이 enforced" 임을 증명하는 테스트 의도가 희석된다. Fallback 으로만 쓴다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hash slot 계산 | 직접 CRC16 구현 | `redis.call('CLUSTER', 'KEYSLOT', key)` (테스트 assertion 에서만 필요) | Valkey 가 wire protocol 로 제공 — 클라이언트 계산은 불필요 |
| Cluster 토폴로지 부트스트랩 | 쉘 스크립트 + `docker exec` 로직 | `testcontainers` + `.withCommand([...])` + `CLUSTER ADDSLOTSRANGE` | 이미 `sms-throttle.integration.spec.ts` 에서 사용 중인 API — 패턴 통일 |
| OTP 저장/대조 atomicity | TypeScript 에서 GET/SET/DEL 체이닝 | 기존 `VERIFY_AND_INCREMENT_LUA` | D-05: Lua 본체 변경 금지 |
| CRC16 모듈 테스트 | `crc` 패키지 설치 | `CLUSTER KEYSLOT` 으로 assertion | 서드파티 CRC 구현 ↔ 실제 Valkey 구현 간 미묘한 차이 회피 |
| Server-message 우선 헬퍼 | `mapVerifyResultToError()` 같은 추가 유틸 | 인라인 3줄 (`typeof res.message === 'string' && res.message.length > 0 ? res.message : fallback`) | D-08 이 이미 한 줄로 정의 — 헬퍼화는 YAGNI |

**Key insight:** 이번 phase 에서 "핸드롤 금지" 의 진짜 대상은 **CROSSSLOT 재현 로직** 이다. 단일 노드 Redis 에 mock 으로 CROSSSLOT 을 시뮬레이션하려고 시도하면(예: InMemoryRedis 에 `crossSlotMode: true` 플래그 추가), 실제 Valkey cluster 와의 동형성이 깨져 다음 번 동일 class 버그를 다시 놓친다. **실제 cluster-enabled 서버를 testcontainer 로 띄우는 것이 유일하게 올바른 회귀 가드**.

## Runtime State Inventory

이번 phase 는 **rename / 정적 refactor 가 아니라 런타임 키 네임스페이스 전환** 이므로 Runtime State Inventory 가 필요하다.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (Memorystore) | 프로덕션 Memorystore for Valkey 의 기존 키: `sms:otp:+821XXXXXXXXX`, `sms:attempts:+821XXXXXXXXX`, `sms:verified:+821XXXXXXXXX` (활성 OTP 보유 유저 수만큼). TTL: 180s / 900s / 600s. | 코드 edit만. D-03: TTL 짧아 배포 후 최대 15분 내 자연 drain. 마이그레이션 불필요. 배포 직후 in-flight OTP 보유 유저는 "재전송" 1회 필요 — HUMAN-UAT 에 명시(D-21). |
| Stored data — 미변경 | `sms:resend:${e164}` (PX 30000), `sms:phone:send:${e164}` (3600s), `sms:phone:verify:${e164}` (900s), `sms:cooldown:${e164}` | **변경 없음 (D-04)**. 이 키들은 단일-key 작업만 하므로 CROSSSLOT 유발 없음. |
| Live service config | Cloud Run `grabit-api` 의 `REDIS_URL` secret (GCP Secret Manager `redis-url`) | 변경 없음. 동일 Valkey endpoint 를 사용. |
| OS-registered state | 없음 — Memorystore 는 fully managed. Cloud Run 도 stateless container. | 없음. |
| Secrets/env vars | 없음. `REDIS_URL` 값은 그대로. | 없음. |
| Build artifacts / installed packages | Cloud Run 이미지 재빌드(deploy) 필요 (새 키 코드 반영). | GitHub Actions `deploy.yml` 이 자동 처리 — 수동 작업 없음. |

**Runtime race scenario** (정보용 — 실제 영향 없음):
- 배포는 Cloud Run revision rollout — 약 1-2분 가량 구/신 pod overlap.
- 구 pod 이 `sms:otp:+82…` 에 OTP#1 을 저장하고 사용자가 `/verify-code` 를 치는 순간 신 pod 에 라우팅되면, 신 pod 은 `{sms:+82…}:otp` 를 조회 → GET 결과 null → CROSSSLOT 이 아니라 정직한 `EXPIRED` → 사용자는 "인증번호 만료, 재발송" 메시지. 구조적으로 "사용자가 틀린 OTP 로 인식" 시나리오는 발생하지 않음 (이번 phase 의 루트 원인과 다름).
- 역방향(신 pod 이 send, 구 pod 이 verify) 도 동일하게 `EXPIRED` 로 귀결 — 안전.
- **결론: 배포 overlap 동안 최악의 경우 해당 사용자가 OTP 를 1회 재전송해야 함. 추가 masking 없음.**

## Common Pitfalls

### Pitfall 1: Lua 본체는 건드리지 않는데 호출부가 부분적으로만 업데이트됨

**What goes wrong:** `sendVerificationCode` 의 `pipeline.set('sms:otp:…')` 만 바꾸고 `verifyCode` 의 `redis.eval(…, 'sms:attempts:…')` 를 놓치거나, 반대 상황. 프로덕션에 나가면 "새 OTP 가 저장됐는데 verify 는 옛 키를 찾으러 감" → 항상 EXPIRED.
**Why it happens:** 문자열 리터럴이 4곳(`sms.service.ts` L221, L222, L363-365 전후)에 분산.
**How to avoid:** D-13 권고대로 `smsOtpKey/smsAttemptsKey/smsVerifiedKey` 빌더 함수를 `export` 하고 모든 호출부가 그것만 쓰도록 강제. 리터럴 `sms:otp:` / `sms:attempts:` / `sms:verified:` 검색 → 결과 0 이어야 완료.
**Warning signs:** `grep -R "sms:otp:" apps/api/src` 가 1건이라도 남아 있으면 불완전.

### Pitfall 2: 통합 테스트의 Lua 본체 복제가 또 drift

**What goes wrong:** `sms-throttle.integration.spec.ts` L286-310 이 Lua 문자열을 그대로 복제해 두고 있음. 이번 phase 에서 Lua 본체는 안 바뀌지만, 테스트는 여전히 **자기만의 키 리터럴** 을 씀(`sms:otp:${phone}` 등 L312-316). 여기서 이름만 고치면 "테스트가 신규 hash-tagged 키로 고쳐졌지만 본문 Lua 는 KEYS[1..3] 로 받아 무관" → 테스트 통과하지만 회귀 가드 의도가 깨짐.
**Why it happens:** 원본 파일에서 Lua 만 import 하고 키 리터럴은 여전히 테스트가 소유.
**How to avoid:** 통합 테스트에서도 `smsOtpKey/…` import 해서 사용 (D-13 SoT). 테스트 내 하드코드 키 리터럴 0 이 정답.
**Warning signs:** PR diff 에서 테스트 파일이 여전히 `sms:otp:` 문자열을 리터럴로 갖고 있으면 red flag.

### Pitfall 3: cluster 테스트가 정상 pass 만 보고 "과거 스킴에서 CROSSSLOT" 를 assert 하지 않음

**What goes wrong:** 새 키로 `VERIFIED/WRONG/EXPIRED/NO_MORE_ATTEMPTS` 4 분기가 pass 하는 시나리오만 추가하면, **"과거 스킴이 실제로 cluster 에서 실패한다"** 는 역방향 증명이 없어 다음 리팩터링 때 hash tag 를 누가 실수로 떼도 테스트가 여전히 green 임.
**Why it happens:** happy-path 편향.
**How to avoid:** **과거 스킴(`sms:otp:${e164}` 등) 으로 EVAL 하는 별도 `it('과거 스킴은 CROSSSLOT 을 던진다')` 블록을 반드시 포함** (D-10 문자 그대로). `await expect(legacyEval()).rejects.toThrow(/CROSSSLOT/)` 패턴.
**Warning signs:** 테스트 파일 안에 `/CROSSSLOT/` 리터럴이 없음.

### Pitfall 4: testcontainer cluster 가 `cluster_state:ok` 이전에 EVAL 을 보냄

**What goes wrong:** `--cluster-enabled yes` 로 기동한 직후의 노드는 `cluster_state:fail` 상태. 이때 EVAL 을 보내면 `CLUSTERDOWN Hash slot not served` 같은 CROSSSLOT 과 다른 에러가 나와서 테스트가 플레이키해짐.
**Why it happens:** `CLUSTER ADDSLOTSRANGE 0 16383` 완료 후에도 자가 확인에 수백 ms 걸림.
**How to avoid:** `beforeAll` 에서 `CLUSTER INFO` 응답에 `cluster_state:ok` 가 나타날 때까지 폴링. 위 Pattern 2 예제의 `for (let i = 0; i < 20; i++)` 루프 참고.
**Warning signs:** CI 에서 간헐적으로 `CLUSTERDOWN` 에러 로그.

### Pitfall 5: `new IORedis.Cluster(...)` 가 internal port 6379 를 resolve 하지 못해 ETIMEDOUT

**What goes wrong:** testcontainer 가 6379 → 랜덤 host port 로 매핑. `IORedis.Cluster` 는 `CLUSTER SLOTS` 응답에서 internal port(6379) 를 받아 그걸로 다시 연결 시도 → 타임아웃.
**Why it happens:** cluster client 는 slot map 의 `host:internalPort` 로 직접 연결하려 함.
**How to avoid:** `natMap` 옵션으로 internal → external 매핑을 주입. 위 Pattern 2 예제 참고 ([CITED: ioredis cluster options](https://redis.github.io/ioredis/)).
**Warning signs:** `Connection is closed.` / `Connect ETIMEDOUT` 에러. `natMap` 없이는 절대 동작하지 않음.

### Pitfall 6: 프론트엔드 테스트가 network call 을 실제로 함

**What goes wrong:** `@testing-library/react` 로 `PhoneVerification` 렌더 후 버튼 클릭 → `apiClient.post` 가 실제 fetch 시도 → jsdom 환경에서 타임아웃.
**Why it happens:** `apiClient.post` 가 내부적으로 `fetch` 호출.
**How to avoid:** `vi.mock('@/lib/api-client', ...)` 로 `apiClient` 를 mock. `post` 가 `{verified:false, message:'인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.'}` 를 resolve 하도록 세팅해 server message 경로를 검증.
**Warning signs:** 테스트 타임아웃 / `TypeError: Failed to fetch`.

## Code Examples

### 1. 키 빌더 + Lua 상수 export (proposed `sms.service.ts` diff)

```typescript
// [VERIFIED: booking.service.ts L127-130 equivalent hash-tag pattern]
// apps/api/src/modules/sms/sms.service.ts  (export 추가, Lua 본체 무변경)

export const smsOtpKey      = (e164: string): string => `{sms:${e164}}:otp`;
export const smsAttemptsKey = (e164: string): string => `{sms:${e164}}:attempts`;
export const smsVerifiedKey = (e164: string): string => `{sms:${e164}}:verified`;

export const VERIFY_AND_INCREMENT_LUA = `
local stored = redis.call('GET', KEYS[1])
if stored == false then
  return {'EXPIRED', 0}
end

local attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then
  redis.call('EXPIRE', KEYS[2], 900)
end

local max = tonumber(ARGV[2])
if attempts > max then
  redis.call('DEL', KEYS[1], KEYS[2])
  return {'NO_MORE_ATTEMPTS', 0}
end

if stored == ARGV[1] then
  redis.call('DEL', KEYS[1], KEYS[2])
  redis.call('SETEX', KEYS[3], tonumber(ARGV[3]), '1')
  return {'VERIFIED', attempts}
end

return {'WRONG', max - attempts}
`;
```

```typescript
// sendVerificationCode (call-site updates only)
const pipeline = this.redis.pipeline();
pipeline.set(smsOtpKey(e164), otp, 'PX', OTP_TTL_MS);
pipeline.del(smsAttemptsKey(e164));

// verifyCode (call-site updates only)
const result = (await this.redis.eval(
  VERIFY_AND_INCREMENT_LUA,
  3,
  smsOtpKey(e164),
  smsAttemptsKey(e164),
  smsVerifiedKey(e164),
  code,
  String(OTP_MAX_ATTEMPTS),
  String(VERIFIED_FLAG_TTL_SEC),
)) as [string, number];
```

### 2. 프론트엔드 수정 (`phone-verification.tsx` L139-144)

```typescript
// BEFORE (L139-144)
if (res.verified) {
  clearTimer();
  onVerified(code);
} else {
  setVerifyError('인증번호가 일치하지 않습니다');
}

// AFTER — D-07/D-08 서버 메시지 우선
if (res.verified) {
  clearTimer();
  onVerified(code);
} else {
  const fallback = '인증번호가 일치하지 않습니다';
  const serverMessage =
    typeof res.message === 'string' && res.message.length > 0
      ? res.message
      : null;
  setVerifyError(serverMessage ?? fallback);
}
```

### 3. Vitest 단위 테스트 (`apps/web/components/auth/phone-verification.test.tsx`)

```typescript
// [CITED: testing-library/react 16.x API]
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhoneVerification } from './phone-verification';

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: vi.fn() },
  ApiClientError: class ApiClientError extends Error {
    constructor(public statusCode: number, message: string) { super(message); }
  },
}));
import { apiClient } from '@/lib/api-client';

describe('PhoneVerification server message priority (D-07)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('서버가 message 를 보내면 그대로 표시 (시스템 에러 구분)', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      verified: false,
      message: '인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.',
    });
    render(<PhoneVerification phone="+821012345678" onPhoneChange={() => {}} onVerified={() => {}} isVerified={false} />);
    // ... trigger send + fill code + click verify ...
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
    });
  });

  it('서버 message 가 없으면 기본 하드코드 fallback', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ verified: false });
    // ...
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('인증번호가 일치하지 않습니다');
    });
  });

  it('빈 문자열 message 도 fallback (D-08 빈 문자열 방어)', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ verified: false, message: '' });
    // ...
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('인증번호가 일치하지 않습니다');
    });
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `valkey-cli --cluster create` 로 3-master 이상만 합법적 cluster | `valkey-server --cluster-enabled yes` + `CLUSTER ADDSLOTSRANGE 0 16383` 로 single-node 합법화 | Valkey 8.x (Redis 7.x 호환) | Memorystore shard=1 과 동형인 test cluster 를 1개 컨테이너로 구성 가능 |
| `grokzen/redis-cluster` 이미지 (Redis fork) | `oliver006/valkey-cluster:latest` (v9.0.1, 2026-01) | 2024-03 Valkey 포크 이후 | Valkey 8 기준 유지보수되는 이미지로 전환 가능 ([CITED: oliver006/docker-valkey-cluster](https://github.com/oliver006/docker-valkey-cluster)) |
| class-validator DTO + 별도 Lua mock | Drizzle-style 서비스 파일 import + 실제 Valkey Lua 실행 | 프로젝트 표준 (CLAUDE.md + 기존 `sms-throttle.integration.spec.ts` 패턴) | Lua / 키 정의의 single source of truth 확보 |

**Deprecated/outdated:**
- `grokzen/redis-cluster`: 개발자가 "NOT intended to be used as a production container" 라고 명시 ([CITED: Grokzen/docker-redis-cluster README](https://github.com/Grokzen/docker-redis-cluster)). Redis fork 기반이라 Valkey 8 호환성 보장 없음.
- `@tosspayments/sdk` (현재 이번 phase 와 무관하지만 CLAUDE.md Stack 에 deprecation 명시) — 참고.

## 1. Hash-Tag 및 CROSSSLOT 근거

Redis Cluster spec 의 hash-tag 알고리즘은 다음과 같다 ([VERIFIED: Redis cluster-spec, 동일 내용이 [Valkey cluster-spec](https://valkey.io/topics/cluster-spec/) 에 mirror]):

```ruby
def HASH_SLOT(key)
  s = key.index "{"
  if s
    e = key.index "}", s+1
    if e && e != s+1
      key = key[s+1..e-1]
    end
  end
  crc16(key) % 16384
end
```

규칙:
1. 첫 번째 `{` 와 그 뒤의 첫 번째 `}` 사이의 substring 이 **비어 있지 않으면** 그것만 hash.
2. 비어 있거나 `{` 가 없으면 전체 키를 hash.
3. 중첩 `{}` 는 "첫 번째 `{` / 첫 번째 `}`" 규칙에 의해 처리 — `foo{{bar}}zap` 은 `{bar` 를 hash.

우리 키 `{sms:+821012345678}:otp` 에 적용:
- 첫 `{` 위치 = 0, 첫 `}` 위치 = 19, 사이 substring = `sms:+821012345678` (16 byte 유효).
- CRC16("sms:+821012345678") % 16384 = 특정 slot. 3개 키 모두 동일 substring 으로 hash 되므로 **slot 이 수학적으로 동일** → CROSSSLOT 제거.

e164 는 `+` + digit 만 존재(libphonenumber-js `parseE164` 결과) 이므로 hash-tag 내부에 `{` 또는 `}` 가 충돌할 수 없음 — 공식 spec 상 안전.

CROSSSLOT 에러 wire-format: `CROSSSLOT Keys in request don't hash to the same slot` ([VERIFIED: redis/ioredis#101](https://github.com/redis/ioredis/issues/101) + 프로젝트 debug session). ioredis 에서는 `ReplyError` 인스턴스로 surface되며 `err.message.includes('CROSSSLOT')` 또는 regex `/CROSSSLOT/` 로 포착 가능.

Valkey 는 Redis 7.x fork 이므로 cluster-spec 은 동일. [CITED: Valkey cluster tutorial](https://valkey.io/topics/cluster-tutorial/) 이 "multiple key operations as long as all of the keys involved in a single command execution ... belong to the same hash slot" 라고 명시.

## 2. Server Message 계약 + 공격 모델 검토 (SC-4)

**계약 — API side:**
`SmsService.verifyCode` 의 `VerifyResult` 는 이미 `{ verified: boolean; message?: string }` 타입. 현재 반환 패턴:

| Scenario | HTTP | Body | Message |
|----------|------|------|---------|
| 정답 | 200 | `{verified:true}` | (없음) |
| 오답 | 200 | `{verified:false, message:'인증번호가 일치하지 않습니다'}` | 틀린 OTP |
| OTP 만료/소진 | 410 (GoneException) | — | |
| 429 rate-limit | 429 | `{message:'잠시 후 다시 시도해주세요', retryAfterMs}` | |
| Valkey eval 실패 (CROSSSLOT 포함) | 200 | `{verified:false, message:'인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.'}` | 시스템 에러 |

**현재 문제:** 프론트가 `res.verified === false` 면 무조건 `'인증번호가 일치하지 않습니다'` 를 노출 → 시스템 에러와 오답이 구별되지 않음.

**수정 후:** `res.message` 우선. 단, 빈 문자열 방어 (D-08).

### 공격 모델 (security-best-practices 관점)

**질문 A: 서버가 "인증번호 확인에 실패했습니다" 와 "인증번호가 일치하지 않습니다" 를 구별함으로써 enumeration oracle 이 되지 않는가?**

- 전제: `[CR-01]` 으로 idempotent short-circuit 은 이미 제거 (sms.service.ts L338-356 주석). 모든 verify 는 실제 Lua EVAL 을 거친다.
- 구별의 정보량: "시스템 에러" 는 Valkey 레벨 실패이고, "WRONG" 은 OTP mismatch. 공격자 관점에서:
  - 시스템 에러는 **phone 과 독립적** (Valkey 자체의 transient 장애). 특정 phone 에 대한 정보를 유출하지 않음.
  - WRONG 은 OTP 가 저장되어 있음을 의미 — 즉 "해당 phone 이 send-code 를 최근 180초 내에 받았다" 를 드러낼 수 있음. 그러나 이미 HTTP status code 410/200/429 의 분기만으로도 **동일 정보가 이미 유출** ([CR-01]/[WR-02] 주석이 verify 카운터를 먼저 올리는 이유가 이것 — enumeration rate 를 10/15min 으로 제한).
  - 결론: 구별은 **새 oracle 을 도입하지 않는다**. rate-limit 가 이미 완화 장치.
- UX 관점: **유저 입장에서 "시스템 에러"와 "틀린 OTP" 를 구분하는 것은 정당한 기대** — 시스템 에러면 재시도해야 하고, 오답이면 문자 메시지 재확인해야 한다. 구별 없이는 4일간 sangwoo 가 겪은 상황("맞는 코드 입력해도 틀렸다") 이 재발.
- **추천: 현재 서버 메시지 그대로 노출 (D-07 대로). 추가 마스킹 불필요.**

**질문 B: hash-tag 키 이름 전환이 새 enumeration/impersonation 벡터를 여는가?**

- 키는 Valkey 내부 이름이며 API 응답에 노출되지 않음. 외부 attack surface 불변.
- `sms:verified:${e164}` 가 `{sms:${e164}}:verified` 로 바뀌어도 SETEX 만 이루어지고, CR-01 주석대로 **더 이상 단독으로 verify 를 gate 하지 않음**. 이 flag 를 읽는 downstream 은 프로젝트 내 다른 코드가 아님(`grep -R "sms:verified" apps/api` 결과로 검증 필요 — plan 단계 task 포함).
- **결론: 공격 surface 에 대한 변화 없음.**

**질문 C: 서버 message 를 그대로 프론트에 렌더링하면 XSS 위험?**

- `setVerifyError(res.message)` → JSX `{verifyError}` 로 text content 렌더. React 가 자동 escape. XSS 없음.
- 단, 미래에 message 에 HTML/링크가 들어가게 되면 `dangerouslySetInnerHTML` 을 쓰지 않는 원칙을 유지해야 함 — 코드 레벨에 주석 추가 권고.

## 3. 배포/회귀 리스크 프로파일

**Cloud Run revision overlap (≤ 2분):**
- 구/신 pod 모두 동일 Memorystore 인스턴스에 붙음. 구 pod 이 쓴 옛 키(`sms:otp:+82...`)는 신 pod 에서 EXPIRED 로 귀결 (§Runtime State Inventory) — safe.
- 반대로 신 pod 이 쓴 새 키(`{sms:+82...}:otp`) 를 구 pod 이 읽으려 하면 `sms:otp:+82...` 를 찾지 못해 EXPIRED. **CROSSSLOT 재발생 없음** (구 pod 의 Lua 는 옛 3개 키를 쓰는데, 그것들은 여전히 cluster 에서 다른 slot 에 매핑되지만, 구 pod 에서 새 OTP 를 저장한 적이 없으므로 `GET sms:otp:…` → null → EXPIRED 가 CROSSSLOT 보다 먼저 발생하여 return). 이게 정확하려면 **Lua 첫 명령이 단일 키 GET** 이어야 하는데, `VERIFY_AND_INCREMENT_LUA` L56 이 `redis.call('GET', KEYS[1])` → 3개 키를 한꺼번에 EVAL 로 던져도 Valkey 는 **EVAL 수신 시점에 KEYS[] 의 slot 을 먼저 검사** 한다는 주의점이 있음.
- **⚠️ 정정:** Redis/Valkey 는 EVAL 을 수신하면 즉시 KEYS[] 전체의 slot 을 검사하여 서로 다르면 **Lua body 가 실행되기 전에 CROSSSLOT** 을 돌려준다 ([CITED: Redis cluster-spec "multi-key commands such as MSET are available only when the keys all belong to the same hash slot"]). 따라서 구 pod 은 overlap 동안 verify 요청 하나당 한 번씩 CROSSSLOT 을 발생시킴 → 사용자는 기존과 동일하게 "인증번호 확인에 실패했습니다" 메시지를 받음.
- **UX 영향:** 신규 프론트 코드는 이 시스템 에러 메시지를 그대로 노출 → 사용자가 "시스템 장애" 로 인식하고 재시도. 이게 바로 D-07 이 도입한 UX 복원.

**배포 체크리스트 (HUMAN-UAT 에 포함 권고):**
1. Cloud Run 배포 직후 1분, 5분, 15분, 60분 시점에 `/signup` 플로우 실기기 시도 (in-flight OTP drain 타임라인 전후).
2. Sentry query: `event:sms.verify_failed AND (message:*CROSSSLOT*)` → 배포 직후 일시적 피크 허용, 15분 후 0 이어야 함.
3. GCP Cloud Logging: `resource.labels.service_name=grabit-api AND jsonPayload.event=sms.verified AND jsonPayload.attempts:*` → 배포 직후부터 VERIFIED 이벤트가 집계되어야 함.

**Rollback 프로파일:**
- 롤백 시 신 pod 이 남긴 `{sms:+82...}:otp` 키는 180초 내 자동 만료 — DB 마이그레이션 같은 부작용 없음. 즉시 `gcloud run deploy … --revision-suffix previous-xxxx` 안전.

## 4. Cluster-mode Valkey 통합 테스트 토폴로지 (D-11 Claude's Discretion)

### 비교표

| # | 옵션 | 이미지 / 구현 | Shard 수 | CROSSSLOT 재현 | Memorystore shard=1 동형 | Startup 시간 | Maintenance | CI 안정성 | 이미 프로젝트 사용 |
|---|------|---------------|----------|----------------|--------------------------|--------------|-------------|-----------|-------------------|
| A ★ | `valkey/valkey:8` + `--cluster-enabled yes` + `CLUSTER ADDSLOTSRANGE 0 16383` | 이미 사용 중 | 1 master / 0 replica | **YES** (단일 노드가 전 slot 소유 상태에서 CROSSSLOT 은 여전히 enforced — 같은 slot 요구 조건 불변) | **최고 (shard=1 일치)** | ~1.5s | **Valkey 공식** (8.x) | HIGH (이미 패턴 사용) | YES |
| B | `oliver006/valkey-cluster:latest` (v9.0.1, 2026-01) | 신규 이미지 풀 필요 | 3 master / 3 replica (기본) 또는 `MASTERS=1 SLAVES_PER_MASTER=0` 로 축소 | YES | 3-master 면 다름 / 1-master 축소 시 일치 | ~8-15s (6노드) 또는 ~3s (축소) | 유지 활발 ([CITED](https://github.com/oliver006/docker-valkey-cluster)) | MEDIUM (6노드 기동 시 flakiness 약간) | NO |
| C | `bitnami/valkey-cluster:latest` | 신규 이미지 풀 필요 | 환경변수 `VALKEY_CLUSTER_REPLICAS` 제어 | YES | 1 master 가능하나 복잡 | ~10s | 유지 활발 (Bitnami/VMware) | MEDIUM | NO |
| D | testcontainers `ComposeContainer` + 3개 `valkey/valkey:8` 노드 | 이미 사용 중 | 3 master / 0 replica | YES | 다름 (shard=3) | ~5-8s | ✓ | LOW (compose orchestration 복잡) | NO |
| E | `grokzen/redis-cluster` (legacy) | Redis fork — **Valkey 아님** | 6 노드 | YES | 다름 | ~8s | DEAD (저자가 prod 금지 명시) | LOW | NO |

★ **권고 (Primary)**: 옵션 A.

### 권고 근거

1. **동형성 최대**: Memorystore 프로덕션은 `shard-count=1`. 옵션 A 는 그것과 정확히 같은 토폴로지(1 master, 0 replica, 전 slot 자기 소유).
2. **기존 패턴 재사용**: `apps/api/test/sms-throttle.integration.spec.ts` 가 이미 `GenericContainer('valkey/valkey:8')` 를 씀. `.withCommand([...])` + `CLUSTER ADDSLOTSRANGE` 만 추가.
3. **외부 의존 0개**: 새 Docker 이미지 풀, 새 devDep 필요 없음. CI 캐시 전략 그대로.
4. **Startup 가장 빠름**: 단일 노드 ~1.5s. 옵션 B/C 는 3-6노드 초기화로 5-15s.
5. **CROSSSLOT enforcement 보장**: [CITED: redis/redis#5118 "CROSSSLOT error on single-shard cluster"](https://github.com/redis/redis/issues/5118) 가 "single-shard 에서도 CROSSSLOT 이 enforced" 임을 bug report 형태로 증명. Issue 의 질문자는 "왜 single-shard 에서도 이게 나지?" 라고 물었고 답은 "spec 상 그게 정상" — 정확히 우리가 원하는 행동.

### Fallback (Primary 가 CI 환경에서 문제 생기면)

옵션 B — `oliver006/valkey-cluster:latest` 를 `MASTERS=1 SLAVES_PER_MASTER=0` 환경변수로 축소. Valkey 8 기반이라 compatibility 확인됨. Startup 약간 느리고 외부 이미지 의존 추가지만 안정적.

### OSS 3-master 최소 요건 질문에 대한 정답

- `valkey-cli --cluster create` 는 최소 3 master 요구 ([CITED: Valkey cluster tutorial](https://valkey.io/topics/cluster-tutorial/)).
- 그러나 **`CLUSTER ADDSLOTS` / `CLUSTER ADDSLOTSRANGE` 는 최소 master 개수 제약 없음** ([CITED: Redis CLUSTER ADDSLOTS](https://redis.io/commands/cluster-addslots/)). 단일 노드에 전 16384 slot 을 할당해 `cluster_state:ok` 진입 가능.
- "3-master 최소" 는 `create-cluster` 스크립트의 관례이자 production HA 고려사항. **테스트 하네스로 쓰려면 수동 `ADDSLOTS` 가 정답**.

### 파일 위치 (D-11 Discretion)

**권고: 기존 `apps/api/test/sms-throttle.integration.spec.ts` 에 `describe('cluster-mode CROSSSLOT regression guard', …)` 블록을 추가하지 말고, 신규 파일 `apps/api/test/sms-cluster-crossslot.integration.spec.ts` 로 분리.**
- 이유: cluster 하네스 `beforeAll` 비용이 standalone 하네스보다 크고, 두 하네스를 한 파일에 섞으면 동일 vitest process 에서 두 컨테이너가 동시에 기동되어 CI 메모리 부담.
- `vitest.integration.config.ts` 의 `testMatch` 는 이미 `test/**/*.integration.spec.ts` 로 추정 — 신규 파일명이 그 패턴에 자동 매칭.

## 5. CROSSSLOT 포획 방식 (ioredis assertion)

- `IORedis.Cluster.eval(...)` 가 CROSSSLOT 을 만나면 **`ReplyError`** 인스턴스로 reject ([VERIFIED: ioredis#101](https://github.com/redis/ioredis/issues/101)).
- Error 메시지: `CROSSSLOT Keys in request don't hash to the same slot` — 고정 문자열.
- Vitest assertion 패턴:

```typescript
await expect(
  cluster.eval(
    VERIFY_AND_INCREMENT_LUA,
    3,
    // 과거 스킴 (hash tag 없음)
    `sms:otp:${phone}`, `sms:attempts:${phone}`, `sms:verified:${phone}`,
    code, '5', '600',
  ),
).rejects.toThrow(/CROSSSLOT/);
```

- 단일 `new IORedis(url)` client 도 동일 에러를 reject — ioredis 의 parser 레이어에서 같은 ReplyError 를 올림.

## 6. `IORedis.Cluster` 최소 옵션 (testcontainer용)

```typescript
const cluster = new IORedis.Cluster(
  [{ host, port }],
  {
    natMap: { [`${host}:6379`]: { host, port } },  // internal 6379 → mapped host port
    lazyConnect: true,                              // await cluster.connect() 명시
    scaleReads: 'master',
    enableReadyCheck: true,
    redisOptions: { maxRetriesPerRequest: 3 },
  },
);
```

옵션 해설 ([CITED: ioredis cluster options](https://redis.github.io/ioredis/index.html)):
- `natMap`: `CLUSTER SLOTS` 가 internal port 6379 를 돌려주므로 host 의 매핑된 랜덤 포트로 rewrite.
- `lazyConnect: true`: 컨테이너 기동/CLUSTER 초기화 타이밍 제어.
- `enableReadyCheck: true`: `cluster_state:ok` 까지 대기.
- `dnsLookup` 은 이 시나리오에선 불필요 (hostname 이 아닌 IP/localhost 직결).

## 7. 기존 테스트 스위트와의 중복·공백 매트릭스 (SC-3)

| 테스트 | 범위 | 하네스 | 이번 phase 대응 |
|--------|------|--------|-----------------|
| `sms-throttle.integration.spec.ts` (describe: SMS Throttle Integration) | @nestjs/throttler + IP 축 rate limit | standalone valkey | 변경 없음 |
| `sms-throttle.integration.spec.ts` (describe: VERIFY_AND_INCREMENT_LUA smoke) | Lua 4분기 (VERIFIED/WRONG/EXPIRED/NO_MORE_ATTEMPTS) 결과 | standalone valkey | **키 리터럴 업데이트 (sms.service import)** — 공백 없이 SoT 동기화 |
| `sms.service.spec.ts` (unit, 있는지 확인 필요) | SmsService.sendVerificationCode / verifyCode 로직 유닛 | mock | phase 후 lint/typecheck 실행 시 부서지면 hash-tag 문자열 기대치 업데이트 |
| **NEW** `sms-cluster-crossslot.integration.spec.ts` | cluster-mode CROSSSLOT 회귀 | 1-master cluster valkey | §9 의 5 시나리오 |
| **NEW** `phone-verification.test.tsx` | 서버 message 우선 / fallback / 빈 문자열 방어 | vitest + jsdom | 3 시나리오 |

공백 영역(이번 phase 에서 **커버 안 함** — 의도적):
- Cloud Run 간 overlap 동안의 실제 구/신 pod 동시성 테스트 (HUMAN-UAT 의 수동 체크로 대체).
- `sms:phone:verify` 카운터 롤백 경로 (이미 unit test 가 있다고 가정 — [WR-04] 주석 근거).
- Infobip SMS 발송 성공 경로 (E2E 영역 — Phase 10.1 에서 커버).

## 8. 프로덕션 배포 체크리스트

1. **배포 전:**
   - `rg "sms:otp:" apps/api/src` → 0 매치.
   - `rg "sms:attempts:" apps/api/src` → 0 매치.
   - `rg "sms:verified:" apps/api/src` → 0 매치.
   - `pnpm --filter @grabit/api typecheck && pnpm --filter @grabit/api lint`.
   - `pnpm --filter @grabit/api test` + `pnpm --filter @grabit/api test:integration` 전부 녹색.
   - `pnpm --filter @grabit/web test` 녹색.
2. **배포 중 (CI):** GitHub Actions `deploy.yml` 기존 플로우 — 신규 secret 없음.
3. **배포 후 0-15분:**
   - 실기기에서 `https://heygrabit.com/signup` → 3단계 SMS 인증 시도 (SC-1 + D-21).
   - 실패 시 Sentry `sms.verify_failed` 로그에 `CROSSSLOT` 포함 여부 즉시 확인 → 포함되어 있으면 **롤백**.
4. **배포 후 1-72시간:**
   - Sentry 쿼리: `event:sms.verify_failed AND message:*CROSSSLOT*` → 15분 이후 0 유지.
   - `jsonPayload.event=sms.verified` 일별 집계 → Phase 10.1 이전 수준(로그 기반)으로 회복.

## 9. 통합 테스트 시나리오 최소 목록 (D-10 회귀 가드)

> **필수 5 시나리오**. Plan 단계에서 추가 가능.

1. **[GUARD] 과거 스킴은 cluster-mode 에서 CROSSSLOT 을 던진다**
   - `cluster.eval(VERIFY_AND_INCREMENT_LUA, 3, 'sms:otp:+821…', 'sms:attempts:+821…', 'sms:verified:+821…', '123456', '5', '600')` → `/CROSSSLOT/` reject.
   - 의의: 다음 번 누군가 hash tag 를 제거하면 이 테스트가 red → 즉시 감지.

2. **[PASS] 새 hash-tagged 스킴은 CROSSSLOT 없이 4 분기 모두 정상 반환**
   - VERIFIED / WRONG / EXPIRED / NO_MORE_ATTEMPTS 네 케이스를 기존 `sms-throttle.integration.spec.ts` 의 smoke 테스트와 동일한 배치로 cluster 위에서 재실행.

3. **[HASH] `CLUSTER KEYSLOT` 이 3개 키에 대해 같은 값을 반환**
   - ```
     const s1 = await cluster.call('CLUSTER', 'KEYSLOT', smsOtpKey(phone));
     const s2 = await cluster.call('CLUSTER', 'KEYSLOT', smsAttemptsKey(phone));
     const s3 = await cluster.call('CLUSTER', 'KEYSLOT', smsVerifiedKey(phone));
     expect(s1).toBe(s2); expect(s2).toBe(s3);
     ```
   - 의의: Hash-tag 계산 결과의 수학적 증명.

4. **[PIPELINE] `sendVerificationCode` 가 하는 pipeline(SET + DEL) 도 CROSSSLOT 없이 성공**
   - 이번 phase 의 send 경로는 단일-key 이므로 이론적으로 CROSSSLOT 무관이지만, 이후 누군가 pipeline 에 verified 키까지 추가했을 때 가드가 됨.

5. **[NEGATIVE] 현재 프로덕션과 동일한 e164 형식(`+821012345678`) 과 특수 케이스(`+8210…`, `+1234567890`) 모두에서 3-key hash 가 동일 slot**
   - e164 내부 `+` / 숫자만 존재하는 조건에서 hash-tag parsing 이 예외 없음을 증명.

## 10. 프론트엔드 테스트 범위 (SC-4)

**권고: Vitest 단위 테스트만 추가. Playwright 추가 불필요.**

이유:
- `phone-verification.tsx` 수정은 "`res.message` 존재 시 우선 / 없을 시 fallback" 의 **순수 분기 로직**. E2E 가 아닌 단위 레벨이 가장 적합.
- @testing-library/react 16 + Vitest 3 는 이미 `apps/web/package.json` 에 devDep. 새 툴 도입 없음.
- 3 시나리오 (서버 message / 없음 / 빈 문자열) 가 1 파일에 모여 소요 < 1s.
- Playwright 로 CROSSSLOT 을 실제 재현하려면 cluster-mode Valkey 를 CI e2e 환경에 띄워야 해서 비용 대비 효용 나쁨.

Optional (원한다면 plan 에서 채택): 기존 signup E2E (Playwright) 에 `page.route('**/sms/verify-code', route => route.fulfill({status:200, body:JSON.stringify({verified:false, message:'...'})}))` 를 넣는 시나리오 1개 추가. 그러나 이는 **"서버 계약의 UI 바인딩"** 을 검증하는 것이지 CROSSSLOT 자체를 검증하지 않음 — 단위 테스트로 커버되는 범위를 벗어나지 않음.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 단일 `valkey/valkey:8` + `CLUSTER ADDSLOTSRANGE 0 16383` 가 `cluster_state:ok` 에 도달해 CROSSSLOT 을 enforce 한다 | §4 Primary 권고 | 만약 Valkey 8 이 특정 내부 체크로 single-node cluster 를 reject 하면 Fallback(B 옵션)으로 전환. 빠르게 검증 가능한 가정 (1 테스트 실행). |
| A2 | Memorystore for Valkey shard=1 이 단일 non-cluster ioredis client 에서 CROSSSLOT 을 그대로 surfacing 한다 (현재 프로덕션이 동작 중인 방식) | §3, §5 | 디버그 세션의 `evidence` 섹션 + [CITED: Memorystore connect-instance doc] 로 이미 검증됨. 추가 검증 필요 없으나, 만약 어떤 이유로 client-side re-route 가 끼어들면 root cause 재확인 필요. |
| A3 | `sms.service.spec.ts` 같은 기존 유닛 테스트가 하드코드된 `sms:otp:` 리터럴에 의존하지 않는다 (또는 있어도 이번 phase 의 키 리네임으로 빠르게 수정 가능) | §7 | 최악의 경우 plan 단계에서 1-2개 유닛 테스트 업데이트 태스크 추가. 낮은 리스크. |
| A4 | e164 문자열에 `{` / `}` 문자가 포함될 가능성이 없다 (`libphonenumber-js.parseE164` 는 `+` + digit 만 반환) | §1 hash-tag spec 적용 분석 | 만약 어떤 phone 표준이 `{` 를 허용하면 hash-tag parsing 이 의도와 다르게 됨 — E.164 spec 상 불가능하므로 매우 낮은 risk. |
| A5 | CI runner 가 Docker 를 사용 가능 (기존 `sms-throttle.integration.spec.ts` 가 이미 같은 조건 필요) | §4 CI 안정성 평가 | 낮은 리스크 — 이미 프로젝트의 integration test CI 가 Docker 기반. |
| A6 | `@sentry/nestjs` 가 현재 프로덕션에서 `sms.verify_failed` 이벤트를 정상 캡처 중 (배포 후 72시간 관측 계획의 전제) | §8 배포 체크리스트 | 디버그 세션의 evidence.timestamp=2026-04-24T02:28:00Z 에서 Sentry 캡처 경로 확인됨. |

**If this table is empty:** 해당 없음 — 6개 가정이 존재하므로 plan 단계에서 A1, A3 는 task 로 변환(A1 → "cluster-mode smoke test 먼저 작성하여 A1 증명", A3 → "기존 유닛 테스트 회귀 점검").

## Open Questions / Risks

1. **Lua 상수 / 키 빌더를 `sms.service.ts` 에 export 만 할지, 신규 `sms.lua.ts` 파일로 분리할지 (D-13 discretion).**
   - 알려진 것: `sms.service.ts` 가 유일한 consumer (테스트 파일까지 합쳐 2곳).
   - 모른 것: 향후 password-reset 이 SMS OTP 를 재사용할 가능성 — 현재 roadmap 에 없음.
   - 권고: **export 로 최소화**. 신규 파일은 over-engineering.
2. **통합 테스트 파일 분리 (Discretion).**
   - 권고: 신규 파일 (§4 근거). 확정은 planner 판단.
3. **Playwright E2E 에 server-message 시나리오를 붙일지.**
   - 권고: 붙이지 않음 (§10). Planner 가 비용 대비 효용을 재판단 가능.
4. **프론트에 `res.message` 를 쓰는 다른 consumer 가 있는지 (Discretion — D-07).**
   - 권고 action: `rg "verify.*message" apps/web` + `rg "VerifyResult" apps/web` 로 planner 단계에서 검색 → 있으면 동일 패치 적용.
5. **CI 에서 cluster container 기동 시 추가되는 소요 초.**
   - 추정: 1-master 옵션 A 기준 약 2-3s beforeAll + 0.5s teardown. 기존 integration suite 가 이미 60-120s 규모이므로 marginal.
   - Risk: 만약 CI runner 에서 Docker pull 이 캐시 miss 되면 +10-30s. 기존 `valkey/valkey:8` 이 이미 pull 되므로 cache hit 예상.
6. **`scripts/provision-valkey.sh` 의 Memorystore 인스턴스가 실제 shard-count=1 인지 재확인.**
   - 스크립트 L54-55: `--shard-count=1 --replica-count=0 --engine-version=VALKEY_8_0` 확인됨. 가정 맞음.
7. **`sms.lua.ts` 모듈 도입 미채택의 downstream 영향.**
   - 영향 없음 — `sms.service.ts` export 만으로 SoT 확보. 향후 Phase 18+에서 SMS OTP 재사용 요구가 생기면 그때 파일 분리.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker (testcontainers) | integration tests | ✓ (이미 `sms-throttle.integration.spec.ts` 사용 중) | 시스템별 | — |
| `valkey/valkey:8` Docker image | new cluster integration test | ✓ (기존 테스트에서 pull) | 8.x | `oliver006/valkey-cluster:latest` (옵션 B) |
| Node.js 22 LTS | vitest / testcontainers-node | ✓ | 22.x (CLAUDE.md stack) | — |
| pnpm workspace | `@grabit/api` + `@grabit/web` 테스트 | ✓ | — | — |
| Memorystore for Valkey (shard=1) | 프로덕션 런타임 | ✓ | VALKEY_8_0 | — |

**Missing dependencies with no fallback:** 없음.
**Missing dependencies with fallback:** 없음.

## Validation Architecture

> `.planning/config.json` → `workflow.nyquist_validation: true` 확인됨. 이 섹션은 필수.

### Test Framework

| Property | Value |
|----------|-------|
| Framework (API) | Vitest 3.2.0 |
| Framework (Web) | Vitest 3.2.0 + @testing-library/react 16.3.0 |
| Config file (API unit) | `apps/api/vitest.config.ts` (존재 가정) |
| Config file (API integration) | `apps/api/vitest.integration.config.ts` (참조: `package.json` `test:integration` script) |
| Config file (Web) | `apps/web/vitest.config.ts` (기존) |
| Quick run command (API unit) | `pnpm --filter @grabit/api test` |
| Quick run command (API integration) | `pnpm --filter @grabit/api test:integration` |
| Quick run command (Web) | `pnpm --filter @grabit/web test` |
| Full suite command | `pnpm --filter @grabit/api test && pnpm --filter @grabit/api test:integration && pnpm --filter @grabit/web test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | 프로덕션 회원가입 SMS OTP 인증 성공 | manual (HUMAN-UAT, 실기기) | 수동 (체크리스트 §8) | ❌ — HUMAN-UAT 수동 |
| SC-2a | cluster-mode 에서 과거 스킴 = CROSSSLOT | integration | `pnpm --filter @grabit/api test:integration sms-cluster-crossslot` | ❌ Wave 0 (신규) |
| SC-2b | cluster-mode 에서 신규 스킴 = PASS (4 분기) | integration | 동상 | ❌ Wave 0 (신규) |
| SC-2c | 3개 키의 `CLUSTER KEYSLOT` 이 동일 | integration | 동상 | ❌ Wave 0 (신규) |
| SC-3a | 기존 throttler smoke 녹색 | integration | `pnpm --filter @grabit/api test:integration sms-throttle` | ✅ (L1-271) |
| SC-3b | 기존 Lua atomic smoke 녹색 (키 상수만 업데이트) | integration | `pnpm --filter @grabit/api test:integration sms-throttle` | ✅ (L272-427) — 수정 필요 |
| SC-3c | `@grabit/api` 전체 unit/integration 녹색 | unit + integration | `pnpm --filter @grabit/api test && pnpm --filter @grabit/api test:integration` | ✅ 기존 |
| SC-4a | 서버 message 존재 시 우선 표시 | unit (web) | `pnpm --filter @grabit/web test phone-verification` | ❌ Wave 0 (신규) |
| SC-4b | message 없거나 빈 문자열이면 fallback | unit (web) | 동상 | ❌ Wave 0 (신규) |
| SC-4c | 정상 verify 시 `onVerified(code)` 호출 + `clearTimer` | unit (web) | 동상 (회귀 가드 — 기존 동작 불변) | ❌ Wave 0 (신규, 회귀 가드 차원) |

### Sampling Rate

- **Per task commit:** `pnpm --filter @grabit/api test phone && pnpm --filter @grabit/web test phone-verification` (빠른 피드백).
- **Per wave merge:** `pnpm --filter @grabit/api test && pnpm --filter @grabit/api test:integration && pnpm --filter @grabit/web test`.
- **Phase gate:** Full suite green + HUMAN-UAT (SC-1) 완료 전까지 `/gsd-verify-work` 통과 보류.

### Wave 0 Gaps

- [ ] `apps/api/test/sms-cluster-crossslot.integration.spec.ts` — SC-2a/b/c 를 cluster-mode 에서 커버 (§9 의 5 시나리오).
- [ ] `apps/web/components/auth/phone-verification.test.tsx` — SC-4a/b/c.
- [ ] `apps/api/test/sms-throttle.integration.spec.ts` — SC-3b 의 키 리터럴을 `smsOtpKey/…` import 로 교체.
- [ ] (export 도입 시) `apps/api/src/modules/sms/sms.service.ts` — `smsOtpKey/smsAttemptsKey/smsVerifiedKey/VERIFY_AND_INCREMENT_LUA` 4개 export.
- [ ] (필요 시) `apps/web/vitest.config.ts` — `jsdom` environment 활성화 확인. 기존 Vitest 가 `apps/web/package.json` 의 `test` script 에 존재하므로 설정 이미 있을 가능성 높음 — planner 가 check.

## Security Domain

> `security_enforcement` 미명시 = 활성.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | OTP 경로는 V2.4 (Credential Recovery & MFA via OTP). 이번 phase 는 기존 OTP 경로 복원 — 새 인증 메커니즘 도입 아님. |
| V3 Session Management | no | JWT/session 경로 무변경. |
| V4 Access Control | no | RBAC 경로 무변경. |
| V5 Input Validation | yes | `parseE164` 가 이미 libphonenumber-js 로 검증. 이번 phase 에서 새 input 도입 없음. |
| V6 Cryptography | no | `randomInt` 로 OTP 생성 (CSPRNG — 기존). 변경 없음. |
| V7 Error Handling & Logging | yes | **D-16 유지 + D-17 72시간 Sentry 관측** — 이번 phase 의 observability 계약. |
| V9 Communication | no | TLS / CDN / CORS 무변경. |
| V11 Business Logic | yes | OTP verify 논리가 비즈니스 로직. hash-tag 수정이 **로직 무변경** 인 것이 D-05 의 의도. |
| V14 Configuration | no | 환경 변수 / secret 무변경. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation | 이번 phase 관련 |
|---------|--------|---------------------|-----------------|
| OTP enumeration via response shape | I (Information Disclosure) | Rate-limit verify 카운터(D-07 기존) + 응답 shape 통일 | §2 질문 A 분석 — 새 oracle 없음 |
| OTP brute force | E (Elevation) | 6-digit × 5 attempts × 10/15min rate-limit | 기존 유지 (D-04 무변경) |
| OTP replay after verify | E | `sms:verified` 플래그 + [CR-01] single-use OTP DEL | 기존 유지 — hash tag 적용 후에도 DEL 로직 불변 |
| Session binding weakness (WR-02) | S (Spoofing) | opaque bound token | Out of scope (D-18 + Deferred Ideas) |
| Resource exhaustion via Valkey eval | D (DoS) | Valkey eval 타임아웃 + Cloud Run autoscale | 기존 유지 |
| Cross-site script via error message | T (Tampering) | React 자동 escape | §2 질문 C 확인 — 안전 |

**이번 phase 가 변경하는 attack surface:** 없음 (키 내부 이름 변경 + UX 에러 문구 구분만). [WR-02] long-term 은 여전히 open.

## Sources

### Primary (HIGH confidence)

- [Redis cluster specification — HASH_SLOT algorithm](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/) — authoritative hash-tag algorithm (Ruby + C refs), Valkey 가 동일 구현.
- [Valkey cluster specification](https://valkey.io/topics/cluster-spec/) — Redis spec mirror.
- [Valkey cluster tutorial](https://valkey.io/topics/cluster-tutorial/) — cluster-enabled options, create-cluster 최소 요건.
- [Redis CLUSTER ADDSLOTS / ADDSLOTSRANGE](https://redis.io/commands/cluster-addslots/) — 수동 slot 할당 API.
- [Google Memorystore for Valkey — Cluster mode enabled/disabled](https://docs.cloud.google.com/memorystore/docs/valkey/cluster-mode-enabled-and-disabled) — CME 정의, 단일 shard 에서도 cluster 프로토콜 유지.
- [Google Memorystore for Valkey — Connect to instance](https://docs.cloud.google.com/memorystore/docs/valkey/connect-instance) — discovery endpoint 단일 IP:port, non-cluster client 에서 MOVED surface.
- [Google Memorystore for Valkey — General best practices](https://docs.cloud.google.com/memorystore/docs/valkey/general-best-practices) — multi-key 제약 + 해시 태그 요구.
- [ioredis documentation](https://redis.github.io/ioredis/index.html) — Cluster options (natMap, lazyConnect, dnsLookup, enableReadyCheck).
- Project internal: `commit b382e39` (booking.service.ts hash-tag 선례) + `.planning/debug/signup-sms-otp-verify-wrong.md` (root cause 확정).

### Secondary (MEDIUM confidence)

- [Testing Redis with testcontainers-node (Kevin Viglucci blog)](https://viglucci.io/articles/testing-redis-with-testcontainers-node) — grokzen 이미지 기반 natMap 패턴. Valkey 로 치환 적용.
- [oliver006/docker-valkey-cluster GitHub](https://github.com/oliver006/docker-valkey-cluster) — Fallback 이미지, v9.0.1 / 2026-01 업데이트, MASTERS/SLAVES_PER_MASTER 환경변수.
- [bitnami/valkey-cluster Docker Hub](https://hub.docker.com/r/bitnami/valkey-cluster) — Fallback 2.
- [redis/redis#5118 "CROSSSLOT error on single-shard cluster"](https://github.com/redis/redis/issues/5118) — single-shard 에서도 CROSSSLOT enforced 확증.
- [redis/ioredis#101](https://github.com/redis/ioredis/issues/101) — CROSSSLOT 이 ReplyError 로 surfacing.
- [Node testcontainers Valkey module](https://node.testcontainers.org/modules/valkey/) — 표준 단일 노드 API (cluster 는 수동 구성).

### Tertiary (LOW confidence / LOW relevance)

- [langfuse#8420 CROSSSLOT discussion](https://github.com/orgs/langfuse/discussions/8420) — 유사 문제 케이스, 참고만.
- [AWS ElastiCache CROSSSLOT knowledge-center](https://repost.aws/knowledge-center/elasticache-crossslot-keys-error-redis) — ElastiCache 문서지만 동일 spec.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 이미 설치된 라이브러리만 사용 (ioredis, testcontainers, vitest). 추가 dep 0.
- Architecture: HIGH — booking.service.ts 선례 답습 + 공식 Redis/Valkey cluster-spec 증명.
- Test topology (D-11): MEDIUM-HIGH — 옵션 A(단일 valkey + CLUSTER ADDSLOTSRANGE) 는 spec 상 동작 확실하나, testcontainer 컨텍스트에서의 초기화 타이밍은 CI 실측 필요.
- Pitfalls: HIGH — 프로젝트 내 유사 클래스 버그(booking) + debug session evidence 로 도출.
- Prod deployment 영향: HIGH — TTL 기반 drain + Cloud Run revision 모델 분석 완료.

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days — stack 안정, 하지만 Memorystore Valkey 기능 업데이트 monitor 필요).
