# Phase 14: SMS OTP CROSSSLOT fix — 프로덕션 회원가입 SMS 인증 정상화 (Valkey Cluster hash tag 적용) - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Source:** PRD Express Path (auto-generated from Phase 13 UAT gap 10 + `.planning/debug/signup-sms-otp-verify-wrong.md`)

<domain>
## Phase Boundary

### In scope

- `apps/api/src/modules/sms/sms.service.ts` — OTP 관련 Valkey 키 3종 (`sms:otp:…`, `sms:attempts:…`, `sms:verified:…`) 에 공통 hash tag 적용 + Lua `VERIFY_AND_INCREMENT_LUA` 주석/키 docstring 동기화 + `sendVerificationCode`/`verifyCode` 호출부 업데이트.
- `apps/web/components/auth/phone-verification.tsx` — 서버가 내려주는 `message` 필드를 하드코드 카피보다 우선 사용하여, Valkey 시스템 에러(CROSSSLOT 등)가 “인증번호가 일치하지 않습니다”로 masking 되지 않도록 UX 구분.
- `apps/api/test/sms-throttle.integration.spec.ts` 의 Lua/key 상수를 실제 서비스 키 형태와 1:1 동기화.
- **Cluster-mode 회귀 가드 인프라**: cluster-mode Valkey 위에서 `VERIFY_AND_INCREMENT_LUA` 를 실제 EVAL 하여 CROSSSLOT 을 재현할 수 있는 통합 테스트 하네스 신설(신규 파일 또는 기존 통합 테스트 파일 확장). Phase 14 런칭 조건이자 동일 class 버그 재발 방지선.
- production SMS OTP 인증 재가동 검증(E2E/수동): `https://heygrabit.com/signup` 3단계에서 회원가입 SMS 인증 성공.

### Out of scope

- SMS 발송 경로(`sendVerificationCode`) 자체 로직 변경 — 현재 pipeline 은 1-key 단위라 CROSSSLOT 을 유발하지 않음. 키 이름만 새 hash tag 규격으로 갱신.
- 기존 `{showtimeId}` 기반 booking 키 스킴 재설계 — 이미 Phase 7/booking fix 로 완료, 참고 패턴으로만 사용.
- `email.service.ts` 관측성 강화(silent `{success:false}` Sentry 캡처) — Phase 15 Resend cutover 와 함께 다룸.
- legal pages(/terms, /privacy, /marketing) 공개 URL — Phase 16.
- Local `/health` 503 (InMemoryRedis.ping 부재) — Phase 17.
- SMS 이용자 세션 토큰 bind(WR-02 long-term) — 별도 백로그.

</domain>

<decisions>
## Implementation Decisions

### [LOCKED] Valkey 키 스킴 (hash tag 규격)

- **D-01** 3개 SMS OTP 키의 공통 hash tag 로 전화번호(e164) 를 사용한다. 최종 키 형태는 다음과 같다:
  - `{sms:${e164}}:otp`
  - `{sms:${e164}}:attempts`
  - `{sms:${e164}}:verified`
  근거: Phase 13 UAT gap 10 `missing[0]`. e164 는 3개 key 가 공유하는 유일한 정체성 축이며 booking 의 `{showtimeId}` pattern 과 1:1 대칭이다. 결과적으로 CRC16 이 동일 slot 으로 매핑되어 CROSSSLOT 소거.
- **D-02** Hash tag 형식은 booking 의 `b382e39` 패턴을 그대로 승계한다: `{<common>}:<role>` (common 은 중괄호 안에 있고 role 은 밖). 기존 `sms:otp:${e164}` → `{sms:${e164}}:otp` 로 순서가 바뀌어 **모든 write/read 호출부와 Lua `VERIFY_AND_INCREMENT_LUA` 호출 시 전달하는 KEYS[1..3] 인자도 동기화 필수**. 병행 운영하지 않는다(브리지 없이 한 번에 전환).
- **D-03** 이전 스킴(`sms:otp:${e164}` 등)은 TTL 이 짧아 즉시 폐기한다.
  - `sms:otp:…` TTL 180s
  - `sms:attempts:…` TTL 900s (Lua 안 첫 INCR 시 EXPIRE)
  - `sms:verified:…` TTL 600s
  - 배포 후 최장 15분 내 기존 키가 자연 drain → 마이그레이션/동시 키 병존 불필요. 사용자 UX 영향 없음(OTP 재발송 필요 시 즉시 재발급).
- **D-04** rate-limit 키(`sms:phone:send:${e164}`, `sms:phone:verify:${e164}`, `sms:cooldown:${e164}`) 는 **이번 phase 에서 건드리지 않는다**. 이들은 Lua 가 아닌 단일-key `INCR`/`DECR`/`DEL` 로만 접근되어 CROSSSLOT 위험 없음. 스킴을 바꾸면 배포 중 기존 quota 가 리셋되어 abuse 창이 생김.

### [LOCKED] Lua 스크립트

- **D-05** `VERIFY_AND_INCREMENT_LUA` 본체는 수정하지 않는다. 키를 KEYS[] 로 받으므로 호출부만 바꿔도 동일 Lua 가 작동한다. docstring(주석의 `KEYS[1] sms:otp:{e164}` 설명)만 새 규격에 맞춰 갱신한다.
- **D-06** `ATOMIC_INCR_LUA` 역시 변경 금지(단일 key 동작).

### [LOCKED] 프론트엔드 UX — server message 우선

- **D-07** `apps/web/components/auth/phone-verification.tsx` 의 `handleVerifyCode` 는 `res.verified === false` 일 때 **`res.message` 가 존재하면 그 값을 `setVerifyError` 에 사용**하고, 없을 때만 기존 하드코드 "인증번호가 일치하지 않습니다" 로 fallback 한다.
  근거: Phase 13 UAT gap 10 `missing[1]`. 시스템 에러(예: CROSSSLOT, Valkey eval failure)에서 서비스가 `{verified:false, message:"인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요."}` 를 내려주고 있음에도 현재는 하드코드 카피가 덮어써 **유저가 틀린 OTP 입력 상황과 혼동**한다. 이번 수정은 “틀린 코드” 와 “시스템 에러”의 사용자 관점 구분선을 복원한다.
- **D-08** 서버 응답의 `message` 는 `string | undefined` 로 타입 안전하게 읽는다(이미 `VerifyResult.message` 는 optional). 빈 문자열 방어: `typeof res.message === 'string' && res.message.length > 0` 일 때만 우선 사용.
- **D-09** 기존 catch 분기(`ApiClientError` 410/422 → 만료 상태) 는 유지한다. HTTPException(GoneException) 경로는 변경 없음.

### [LOCKED] 회귀 가드 — cluster-mode 통합 테스트

- **D-10** 회귀 테스트는 “cluster-mode 인 Valkey 위에서 `VERIFY_AND_INCREMENT_LUA` 를 새 key 스킴으로 EVAL 했을 때 CROSSSLOT 이 나지 않는다” 를 검증해야 한다. 역도 필요: 과거 스킴(`sms:otp:${e164}` 등 hash tag 없음) 은 같은 cluster 에서 **CROSSSLOT ReplyError** 를 던져야 한다(가드로서 회귀 탐지력 보장).
- **D-11** 구현 방식은 **Claude's Discretion** 으로 둔다. 유력 후보:
  1. `testcontainers` 로 cluster-mode Valkey 를 띄운다(예: `valkey/valkey:8` 를 `--cluster-enabled yes` + `cluster create` 부트스트랩, 또는 `grokzen/redis-cluster` 류 이미지로 3-master 1-replica 토폴로지).
  2. `ioredis.Cluster` 클라이언트를 테스트에서 생성(프로덕션 단일 ioredis 클라이언트 그대로 둔다 — 테스트 인프라 차원의 cluster 검증).
  3. 실제 환경과 동형성을 지키기 위해 Memorystore for Valkey shard-count=1 과 동등한 “single-shard cluster” 구성을 우선 시도.
  결정은 research 단계에서 Drizzle-style best practice/Memorystore Valkey Lua cluster 문서를 근거로 확정한다.
- **D-12** 이 테스트는 CI 에 들어가야 한다. Phase 10.1 릴리스 당시 standalone valkey 테스트가 green 이었는데도 프로덕션이 CROSSSLOT 을 터뜨린 **원인(테스트 커버리지 공백)을 구조적으로 제거**하는 것이 이번 phase 의 2차 deliverable.
- **D-13** 기존 `apps/api/test/sms-throttle.integration.spec.ts` 안에는 `VERIFY_AND_INCREMENT_LUA` 를 **그대로 문자열로 복제해 두는 패턴(line 272-316)** 이 있다. 이번 phase 에서는 (a) 키 상수를 서비스와 공통화하거나, (b) Lua 본체와 키 헬퍼를 `sms/sms.lua.ts`(신규) 같은 전용 모듈로 export 해 테스트가 **원본을 import 하도록** 단일 source of truth 로 정리한다. 이 규약을 따르지 않으면 다음 번에도 같은 drift 가 재발한다.

### [LOCKED] 백엔드 에러 의미 구분

- **D-14** `SmsService.verifyCode` 의 generic catch(L390-415) 는 **변경하지 않는다**. CROSSSLOT 자체는 hash tag 수정으로 더 이상 발생하지 않아야 하며, generic catch 는 unknown Valkey 장애에 대한 방어선으로 유지한다. 다만 return message("인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.")가 클라이언트에 그대로 노출되도록 D-07 과 짝을 이룬다.
- **D-15** catch 안의 `sms:phone:verify:${e164}` counter 롤백(`decr`) 은 **새 rate-limit 키 스킴 그대로 유지**(D-04). 새 hash tag 스킴 적용 대상 아님.

### [LOCKED] 관측성

- **D-16** `sms.service.ts` 의 기존 Sentry/logger 스코프는 유지한다. 추가 메타데이터(예: redis key slot) 주입은 본 phase 범위 밖.
- **D-17** 단, 수정 후 배포 직후 사용자 OTP 인증 성공이 확인될 때까지 Cloud Run `grabit-api` Sentry 에 `sms.verify_failed` 이벤트가 CROSSSLOT keyword 로 나타나는지 **수동 관측 항목** 으로 HUMAN-UAT 에 남긴다(배포 후 72시간 모니터링 창).

### [LOCKED] 범위 가드

- **D-18** 이 phase 는 “**프로덕션 회원가입 SMS OTP 인증이 정상 성공한다**” 라는 단일 목표로 유지한다. 동일 root cause 가 없는 다른 SMS 기능(예: 비밀번호 재설정이 향후 SMS OTP 기반으로 바뀔 때의 범용화) 은 defer.
- **D-19** 마이그레이션 스크립트/플래그 없이 한 번에 배포한다(D-03 근거). 배포 후 15분 간 기존 in-flight OTP 를 가진 사용자는 새 OTP 재발송이 필요할 수 있음을 HUMAN-UAT 에서 명시.

### [LOCKED] 검증 & UAT 계약

- **D-20** Success Criteria:
  1. 프로덕션(`https://heygrabit.com`) 에서 실기기로 회원가입 SMS 발송 → 수신된 OTP 입력 → 회원가입 3단계 진행이 성공한다. (SC-1)
  2. cluster-mode Valkey 위에서 통합 테스트가 과거 key 스킴 = CROSSSLOT fail, 신규 key 스킴 = pass 로 동작한다. (SC-2)
  3. `apps/api/test/sms-throttle.integration.spec.ts` 가 녹색, 전체 `pnpm --filter @grabit/api test` 녹색. (SC-3)
  4. `phone-verification.tsx` 에서 서버가 message 를 내린 경우(시스템 에러 유도 시나리오) 하드코드가 아닌 서버 문구가 노출됨 — Playwright/유닛 테스트 레벨 확인. (SC-4)
- **D-21** HUMAN-UAT 체크리스트는 Phase 13 UAT gap 10 의 원래 failure 시나리오를 그대로 재현한 것을 포함한다(“실제 SMS 수신 → 같은 코드 입력 → 성공”).

### Claude's Discretion

- Cluster-mode Valkey 테스트 토폴로지의 정확한 이미지/설정(D-11): testcontainers 로 커스텀 스크립트 쓸지 기존 `grokzen/redis-cluster` 를 쓸지, shard 수 3 vs 1 이 CROSSSLOT 재현과 Memorystore 환경 동형성 사이에서 어느 쪽이 적합한지 research 에서 결론낼 것.
- `sms.lua.ts` 모듈 도입 여부(D-13): 구조적 정리가 과한 경우 `sms.service.ts` 에서 상수(키 빌더 함수 + Lua 본체)를 export 하는 선에서 멈춰도 된다.
- 프론트엔드 server-message 적용 범위(D-07): `phone-verification.tsx` 외에 다른 consumer 가 있으면 찾아서 같이 적용 — `apiClient.post` 응답 shape 은 이미 `{ verified: boolean; message: string }` 로 약속되어 있으므로 discovery 부담 낮음.
- 통합 테스트 파일 위치: 기존 `sms-throttle.integration.spec.ts` 를 확장할지(cluster-mode describe block 추가) 새 파일 `sms-cluster-crossslot.integration.spec.ts` 로 분리할지.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Root cause + 수정 계획 (절대적 1차 출처)

- `.planning/debug/signup-sms-otp-verify-wrong.md` — 4일간 디버깅의 결과물. hypothesis/evidence/falsification_test/fix_rationale 완결. 이번 phase 의 단일 source of truth.
- `.planning/phases/13-grapit-grabit-rename/13-UAT.md` — gap 10 섹션(L125-143): root_cause, artifacts, missing items 3종.

### 참조 패턴(같은 repo, 동일 class 버그의 선례 수정)

- git commit `b382e39` — `fix(booking): add Redis Cluster hash tags to prevent CROSSSLOT errors (#14)`. SMS 과 동일 `{common}:role` 스킴 + Lua KEYS 전달 패턴. **문자 그대로 답습할 것.**
- `apps/api/src/modules/booking/booking.service.ts` L18-L140 — hash tag 규격이 적용된 Lua docstring 3종(LOCK/UNLOCK/GET_VALID_LOCKED_SEATS) + 호출부(`userSeatsKey`, `lockKey`, `lockedSeatsKey`, `keyPrefix`) 작명/조립.
- `apps/api/src/modules/booking/providers/redis.provider.ts` — InMemoryRedis mock 이 hash tag 패턴 키를 어떻게 파싱하는지 참조(SMS 쪽도 mock 영향 평가 필요 시).

### 현행 SMS 코드

- `apps/api/src/modules/sms/sms.service.ts` L39-79 (Lua), L201-286 (`sendVerificationCode`), L308-416 (`verifyCode`).
- `apps/web/components/auth/phone-verification.tsx` L129-158 (`handleVerifyCode`).
- `apps/api/test/sms-throttle.integration.spec.ts` L272-316 (Lua 복제), L312-316 (`keys()` 헬퍼), L318-326 (`beforeAll` testcontainer 설정), L337- (정답/오답/만료/소진 4 시나리오).

### 인프라 (cluster-mode Valkey 이해)

- `scripts/provision-valkey.sh` — Memorystore for Valkey 프로비저닝 커맨드. shard-count=1 이어도 cluster 모드임을 확인.
- `.planning/phases/13-grapit-grabit-rename/HANDOFF.md` §3.2 — prod 에서 `REDIS_URL` secret 를 grabit-api 가 어떻게 주입받는지.

### 프로젝트 규칙

- `CLAUDE.md` — 모노레포 CLAUDE.md (ES modules, strict typing, no Co-Authored-By, conventional commits).
- `.planning/CLAUDE.md`(루트 CLAUDE.md 의 Conventions 섹션) — `.env` 루트 위치, drizzle-kit `DOTENV_CONFIG_PATH` 규약(이번 phase 에선 DB 변경 없음 → 참고용).

### Requirements

- ROADMAP.md Phase 14 섹션(§243-251) 현재는 Goal=[To be planned], Requirements=TBD. 본 CONTEXT.md 가 Success Criteria SC-1~SC-4 를 정의(D-20) — ROADMAP 동기화는 planner 가 처리하거나 최소 plan frontmatter 의 `requirements` 필드에 `SC-1`..`SC-4` 로 반영.

</canonical_refs>

<specifics>
## Specific Ideas

- **전/후 비교 표**(실장 실수 방지):
  | 역할 | 현행 | Phase 14 이후 |
  | ---- | ---- | ------------- |
  | OTP 저장 | `sms:otp:${e164}` | `{sms:${e164}}:otp` |
  | 시도 카운터 | `sms:attempts:${e164}` | `{sms:${e164}}:attempts` |
  | 검증 완료 플래그 | `sms:verified:${e164}` | `{sms:${e164}}:verified` |
  | phone-axis 송신 쿼터 | `sms:phone:send:${e164}` | **변경 없음** |
  | phone-axis 검증 쿼터 | `sms:phone:verify:${e164}` | **변경 없음** |
  | 30s 재전송 쿨다운 | `sms:cooldown:${e164}` | **변경 없음** |
- Lua EVAL 호출 시 KEYS 순서는 기존과 동일(`[otp, attempts, verified]`) → 코드 흐름 변경 없음, 이름만 변경.
- `sendVerificationCode` 의 pipeline 안 두 줄(`set(sms:otp:...)`, `del(sms:attempts:...)`) 도 새 이름으로 동시 갱신.
- `phone-verification.tsx` 수정 패치 예시:
  ```ts
  const fallback = '인증번호가 일치하지 않습니다';
  const serverMessage = typeof res.message === 'string' && res.message.length > 0 ? res.message : null;
  setVerifyError(serverMessage ?? fallback);
  ```
- Falsification test(이미 debug session 에 기재): `redis-cli -h <memorystore-ip> EVAL <VERIFY_AND_INCREMENT_LUA> 3 sms:otp:X sms:attempts:X sms:verified:X 123456 5 600` 으로 사전 재현 가능. 배포 전 staging 이 없다면 **cluster-mode 통합 테스트가 해당 falsification 을 자동화하는 유일한 경로**.

</specifics>

<deferred>
## Deferred Ideas

- SMS verify 성공 시 서버가 opaque bound token 을 내려주고 downstream(signup/password-reset) 이 이를 필수로 검증하는 구조 개선(WR-02 long-term) — 별도 phase.
- `email.service.ts` 의 silent `{success:false}` Sentry 캡처(Phase 13 UAT gap 9 `missing[3]`) — Phase 15 Resend cutover 와 번들.
- `/legal/*` 페이지 신설(gap 11) — Phase 16.
- Local dev `/health` 503 fix(gap 1) — Phase 17.
- SMS 발송 경로의 rollback observability 개선(WR-02/WR-04 응용) — 회원가입 OTP 흐름이 안정화된 뒤 후속.

</deferred>

---

*Phase: 14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag*
*Context gathered: 2026-04-24 via PRD Express Path (debug session + Phase 13 UAT gap 10)*
