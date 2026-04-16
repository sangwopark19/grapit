---
phase: 10
plan: 02
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/api/package.json
  - apps/web/package.json
  - pnpm-lock.yaml
  - .env.example
  - .planning/phases/10-sms/DEPLOY-CHECKLIST.md
autonomous: true
requirements: [SMS-02, SMS-03]
must_haves:
  truths:
    - "twilio npm 의존성 제거됨"
    - "@nest-lab/throttler-storage-redis ^1.2.0, libphonenumber-js ^1.12.41 apps/api에 추가"
    - "libphonenumber-js ^1.12.41 apps/web에 추가(국가 감지 UI)"
    - "INFOBIP_* 4종 env가 .env.example에 문서화"
    - "TWILIO_* 3종 env가 .env.example에서 제거"
    - "Infobip 콘솔 운영 체크리스트(Application/Message Template 사전생성) 문서 존재"
  artifacts:
    - path: "apps/api/package.json"
      provides: "twilio 제거, @nest-lab/throttler-storage-redis + libphonenumber-js 추가"
      contains: "@nest-lab/throttler-storage-redis"
    - path: "apps/web/package.json"
      provides: "libphonenumber-js 추가(프론트 국가 감지)"
      contains: "libphonenumber-js"
    - path: ".env.example"
      provides: "INFOBIP_* 환경변수 스켈레톤 + TWILIO_* 제거"
      contains: "INFOBIP_API_KEY"
    - path: ".planning/phases/10-sms/DEPLOY-CHECKLIST.md"
      provides: "Infobip 콘솔 운영자 수동 작업 체크리스트"
      contains: "pinAttempts=5"
  key_links:
    - from: "apps/api/package.json"
      to: "@nest-lab/throttler-storage-redis"
      via: "Plan 07 ThrottlerModule forRootAsync storage"
      pattern: "@nest-lab/throttler-storage-redis"
    - from: ".env.example"
      to: "apps/api/src/modules/sms/sms.service.ts"
      via: "Plan 05 hard-fail 생성자"
      pattern: "INFOBIP_API_KEY"
---

<objective>
Phase 10 코드 작성 이전에 의존성 교체와 환경변수 문서를 완료한다. CONTEXT D-02(twilio 제거), D-16(env 4종 추가), D-17(GitHub Actions secrets 로테이션), D-04(Infobip 콘솔 사전작업 운영 체크리스트)를 반영. RESEARCH §"Installation"의 명령어 그대로 실행.

Purpose: Wave 1+ 코드가 import할 패키지가 존재해야 하고, `.env.example`이 최신이어야 로컬 dev 시작이 가능하다. Infobip 콘솔 작업은 코드 배포 전 별도 운영자 수행 필요 → 체크리스트 문서로 고정.

Output: package.json 2개 + pnpm-lock.yaml 갱신 + .env.example + DEPLOY-CHECKLIST.md.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/10-sms/10-CONTEXT.md
@.planning/phases/10-sms/10-RESEARCH.md
@apps/api/package.json
@apps/api/src/modules/sms/sms.service.ts
</context>

<tasks>

<task type="auto">
  <id>10-02-T1</id>
  <name>Task 1: twilio 제거 + @nest-lab/throttler-storage-redis + libphonenumber-js 추가 (apps/api)</name>
  <files>apps/api/package.json, pnpm-lock.yaml</files>
  <description>RESEARCH §"Installation" 명령어대로 twilio를 apps/api에서 제거하고 @nest-lab/throttler-storage-redis@^1.2.0 + libphonenumber-js@^1.12.41을 추가한다.</description>
  <read_first>
    - apps/api/package.json (현재 twilio ^5.13.1 존재)
    - .planning/phases/10-sms/10-RESEARCH.md §"Installation"
    - .planning/phases/10-sms/10-RESEARCH.md §"Standard Stack > Core Additions"
    - .planning/phases/10-sms/10-CONTEXT.md D-02
  </read_first>
  <action>
    프로젝트 루트에서 실행:

    ```bash
    pnpm --filter @grapit/api remove twilio
    pnpm --filter @grapit/api add @nest-lab/throttler-storage-redis@^1.2.0 libphonenumber-js@^1.12.41
    ```

    이 작업은 apps/api/package.json과 pnpm-lock.yaml을 함께 갱신한다. twilio는 `dependencies`에서 완전 제거. 기존 sms.service.ts의 `import Twilio from 'twilio'`는 Plan 05에서 제거 — 지금 시점에서는 typecheck 실패가 예상되므로 이 task 후 바로 다음 wave로 넘어간다(RED 의도).

    두 패키지 설치 후 `node_modules/@nest-lab/throttler-storage-redis/package.json`의 peerDependencies 확인 — `@nestjs/common ^11.0.0`, `@nestjs/throttler >=6.0.0`, `ioredis >=5.0.0` 명시되어 있으면 NestJS 11 호환성 검증 완료(RESEARCH Assumption A4).
  </action>
  <acceptance_criteria>
    - `! grep -q '"twilio"' apps/api/package.json` (twilio 완전 제거)
    - `grep -q '"@nest-lab/throttler-storage-redis": "\\^1\\.2' apps/api/package.json`
    - `grep -q '"libphonenumber-js": "\\^1\\.12' apps/api/package.json`
    - `pnpm-lock.yaml`에서 `twilio:` 레퍼런스 없음(`grep -c "^  /twilio" pnpm-lock.yaml` == 0 또는 이에 준하는 확인)
    - `pnpm-lock.yaml`에서 `@nest-lab/throttler-storage-redis` 검색 매치
    - `pnpm install --frozen-lockfile` 성공(다른 오류 없음 — twilio import는 아직 Plan 05에서 제거 전이므로 typecheck는 fail 가능, install은 성공해야 함)
  </acceptance_criteria>
  <verify>
    <automated>! grep -q '"twilio"' apps/api/package.json && grep -q '"@nest-lab/throttler-storage-redis"' apps/api/package.json && grep -q '"libphonenumber-js"' apps/api/package.json && pnpm install --frozen-lockfile 2>&1 | tail -5 | grep -q "Done\|already up"</automated>
  </verify>
  <requirements>SMS-02</requirements>
  <autonomous>true</autonomous>
  <commit>build(10-02): replace twilio with infobip deps (@nest-lab/throttler-storage-redis, libphonenumber-js)</commit>
  <done>twilio 완전 제거, 2개 신규 패키지 설치, lockfile 갱신, pnpm install 성공</done>
</task>

<task type="auto">
  <id>10-02-T2</id>
  <name>Task 2: libphonenumber-js 추가 (apps/web) — 국가 감지</name>
  <files>apps/web/package.json, pnpm-lock.yaml</files>
  <description>UI-SPEC §"국가 감지 구현 권장"대로 프론트에 libphonenumber-js를 추가한다. Plan 08에서 `apps/web/lib/phone.ts` 유틸이 이 패키지의 `parsePhoneNumberFromString` / `/min` 빌드를 import.</description>
  <read_first>
    - apps/web/package.json (현재 libphonenumber-js 미존재 추정)
    - .planning/phases/10-sms/10-UI-SPEC.md §"국가 감지 구현 권장" (discretion)
    - .planning/phases/10-sms/10-RESEARCH.md §"Installation" (프론트엔드)
  </read_first>
  <action>
    ```bash
    pnpm --filter @grapit/web add libphonenumber-js@^1.12.41
    ```

    `libphonenumber-js/min` sub-entry(~80KB metadata)를 사용하여 번들 부담 최소화 — import 패턴은 Plan 08이 결정. 여기서는 설치만.
  </action>
  <acceptance_criteria>
    - `grep -q '"libphonenumber-js": "\\^1\\.12' apps/web/package.json`
    - `pnpm-lock.yaml`에서 apps/web 섹션에 libphonenumber-js 레퍼런스 존재
    - `pnpm --filter @grapit/web install --frozen-lockfile` 성공
  </acceptance_criteria>
  <verify>
    <automated>grep -q '"libphonenumber-js"' apps/web/package.json && grep -q "libphonenumber-js" pnpm-lock.yaml</automated>
  </verify>
  <requirements>SMS-02</requirements>
  <autonomous>true</autonomous>
  <commit>build(10-02): add libphonenumber-js to web for country detection UI</commit>
  <done>apps/web/package.json에 libphonenumber-js 추가, lockfile 갱신</done>
</task>

<task type="auto">
  <id>10-02-T3</id>
  <name>Task 3: .env.example — TWILIO_* 제거 + INFOBIP_* 4종 추가 + 운영 체크리스트 주석</name>
  <files>.env.example</files>
  <description>CONTEXT D-16 명시 4 env 추가 + CLAUDE.md 요구(선택 환경변수 문서화) 반영. D-17의 GitHub Actions secrets 변경은 Plan 09 deploy 체크리스트에서 상세 처리.</description>
  <read_first>
    - .env.example (현재 루트 존재 — TWILIO_* 3종 있음)
    - .planning/phases/10-sms/10-CONTEXT.md D-14, D-15, D-16, D-17
    - .planning/phases/10-sms/10-RESEARCH.md §"Common Pitfalls > Pitfall 2"
    - CLAUDE.md (프로젝트 루트) "환경변수" 섹션 — `.env` 루트 1개 규칙
  </read_first>
  <action>
    `.env.example`에서 다음 3개 라인 완전 삭제(앞뒤 주석 포함):
    ```
    TWILIO_ACCOUNT_SID=
    TWILIO_AUTH_TOKEN=
    TWILIO_VERIFY_SERVICE_SID=
    ```

    다음 블록을 삭제된 위치 또는 적절한 SMS 섹션에 추가:
    ```
    # ---- SMS (Infobip 2FA) ----
    # D-14, D-16: production에서 4종 모두 필수. 하나라도 비면 SmsService 생성자 throw(hard-fail)
    # D-15: NODE_ENV !== 'production' + 아래 값 전부 미설정일 때만 dev mock 모드(000000 유니버설 코드)
    # Infobip 콘솔에서 Application + Message Template 사전 생성 필요 (DEPLOY-CHECKLIST.md 참조)
    INFOBIP_API_KEY=
    INFOBIP_BASE_URL=
    INFOBIP_APPLICATION_ID=
    INFOBIP_MESSAGE_ID=
    ```

    주석은 CONTEXT.md 결정 ID(D-14, D-15, D-16)를 인용해 traceability 확보.

    `.env.example`에 기존 `INFOBIP_*`이 우연히 있으면 덮어쓰기. CLAUDE.md §"환경변수"의 "루트 1개" 규칙 준수 — `apps/api/.env` 생성 금지.
  </action>
  <acceptance_criteria>
    - `! grep -q "TWILIO_ACCOUNT_SID" .env.example`
    - `! grep -q "TWILIO_AUTH_TOKEN" .env.example`
    - `! grep -q "TWILIO_VERIFY_SERVICE_SID" .env.example`
    - `grep -q "^INFOBIP_API_KEY=" .env.example`
    - `grep -q "^INFOBIP_BASE_URL=" .env.example`
    - `grep -q "^INFOBIP_APPLICATION_ID=" .env.example`
    - `grep -q "^INFOBIP_MESSAGE_ID=" .env.example`
    - `grep -q "D-14\\|D-15\\|D-16" .env.example` (decision id traceability)
    - `grep -q "000000" .env.example` (dev mock 명시)
    - 실제 시크릿 값 0건(`grep -qE "INFOBIP_.*=[a-zA-Z0-9]{8,}" .env.example` 이 match되지 않아야 함)
  </acceptance_criteria>
  <verify>
    <automated>! grep -q "TWILIO_" .env.example && grep -q "^INFOBIP_API_KEY=" .env.example && grep -q "^INFOBIP_BASE_URL=" .env.example && grep -q "^INFOBIP_APPLICATION_ID=" .env.example && grep -q "^INFOBIP_MESSAGE_ID=" .env.example && grep -q "D-1[456]" .env.example</automated>
  </verify>
  <requirements>SMS-03</requirements>
  <autonomous>true</autonomous>
  <commit>docs(10-02): replace TWILIO_* with INFOBIP_* in .env.example per D-16</commit>
  <done>TWILIO_* 3개 완전 제거, INFOBIP_* 4개 추가, D-14/D-15/D-16 주석 포함, 실 시크릿 없음</done>
</task>

<task type="auto">
  <id>10-02-T4</id>
  <name>Task 4: Infobip 콘솔 운영 체크리스트 문서 작성</name>
  <files>.planning/phases/10-sms/DEPLOY-CHECKLIST.md</files>
  <description>D-04 한국 발신번호 KISA 등록 + RESEARCH Pitfall 4(Application/Template 사전생성) + D-17 GitHub Actions secrets 로테이션을 체크리스트로 고정. 본 문서는 코드 배포 전 운영자 수동 작업 가이드.</description>
  <read_first>
    - .planning/phases/10-sms/10-CONTEXT.md D-04, D-17
    - .planning/phases/10-sms/10-RESEARCH.md §"Common Pitfalls > Pitfall 4"
    - .planning/phases/10-sms/10-RESEARCH.md §"Runtime State Inventory"
    - .planning/phases/10-sms/10-VALIDATION.md §"Manual-Only Verifications"
  </read_first>
  <action>
    `.planning/phases/10-sms/DEPLOY-CHECKLIST.md` 작성 — 운영자가 Phase 10 배포 전/후 체크해야 할 수동 작업:

    구조:
    ```markdown
    # Phase 10 — Infobip SMS Deploy Checklist

    > **Audience:** 운영자(프로젝트 오너) — 코드 배포와 별도 수동 작업.
    > **When to run:** Plan 05(SmsService 재작성) 커밋 이후, production 배포 이전.

    ## 1. Infobip Portal 계정 확보
    - [ ] https://portal.infobip.com 가입 / 계정 활성화
    - [ ] 계정별 API base URL 확인 (예: `xxxxx.api.infobip.com`) → `INFOBIP_BASE_URL` 값으로 사용
    - [ ] Billing 설정(선불 또는 계약)

    ## 2. 한국 발신번호 사전등록 (KISA)
    - [ ] Infobip portal → Channels & Numbers → Sender ID 또는 Numbers → Register Korea SenderID
    - [ ] `Grapit` 발신자명 또는 한국 특수번호 신청
    - [ ] KISA 심사 통과 (영업일 3~5일) 후 "Approved" 상태 확인
    - D-04 근거: 운영자 수동. 코드는 영향 없음.

    ## 3. 2FA Application 생성 (Pitfall 4)
    - [ ] Portal → 2FA → Applications → Create
    - [ ] Settings:
      - `name`: Grapit Signup OTP
      - `pinAttempts`: **5** (D-12)
      - `allowMultiplePinVerifications`: true
      - `pinTimeToLive`: **3m** (D-10)
      - `verifyPinLimit`: `1/3s`
      - `sendPinPerApplicationLimit`: `10000/1d`
      - `sendPinPerPhoneNumberLimit`: **5/1h** (D-06 방어선 중 Infobip 레이어)
    - [ ] Application ID 복사 → `INFOBIP_APPLICATION_ID`

    ## 4. Message Template 생성
    - [ ] Portal → 2FA → Messages → Create
    - [ ] Settings:
      - `messageText`: `"[Grapit] 인증번호 {{pin}} (3분 이내 입력)"`
      - `pinType`: **NUMERIC** (D-13)
      - `pinLength`: **6** (D-13)
      - `senderId`: 2번 단계에서 승인된 SenderID
    - [ ] Message ID 복사 → `INFOBIP_MESSAGE_ID`

    ## 5. API Key 발급
    - [ ] Portal → Developers → API Keys → Create
    - [ ] 권한: 2FA 전체 (sendPin, verifyPin)
    - [ ] Key 복사 → `INFOBIP_API_KEY` (한 번만 노출, 안전한 곳 보관)

    ## 6. GCP Secret Manager 업데이트 (D-17)
    ```bash
    gcloud secrets create infobip-api-key --data-file=- <<< "<API_KEY>"
    gcloud secrets create infobip-base-url --data-file=- <<< "<BASE_URL>"
    gcloud secrets create infobip-application-id --data-file=- <<< "<APP_ID>"
    gcloud secrets create infobip-message-id --data-file=- <<< "<MSG_ID>"

    # Twilio secrets 삭제 (또는 비활성화)
    gcloud secrets delete twilio-account-sid
    gcloud secrets delete twilio-auth-token
    gcloud secrets delete twilio-verify-service-sid
    ```

    ## 7. GitHub Actions Secrets (D-17)
    - [ ] Settings → Secrets and variables → Actions
    - [ ] Delete: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`
    - [ ] Add: `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, `INFOBIP_APPLICATION_ID`, `INFOBIP_MESSAGE_ID`
    - CI Playwright는 `INFOBIP_API_KEY`를 **주입하지 않음** (D-24 mock 모드 자동 진입).

    ## 8. Cloud Run env binding
    - [ ] Cloud Run `api` 서비스 → Edit & Deploy New Revision → Variables & Secrets
    - [ ] 4종 INFOBIP_* secret → env var binding
    - [ ] Twilio env var 3종 Remove

    ## 9. Staging Smoke Test (D-25)
    - [ ] staging 환경에서 본인 번호로 `/sms/send-code` 호출 → SMS 수신 확인
    - [ ] `/sms/verify-code`로 인증 성공 확인
    - [ ] staging 응답 JSON을 `apps/api/src/modules/sms/__fixtures__/infobip-*-response.json` 과 diff → 필드명 불일치 시 fixture + SmsService mapping 업데이트 (RESEARCH Assumption A1, A2)

    ## 10. Production 배포
    - [ ] Cloud Run cold-start 이후 첫 요청 Sentry alert 없는지 5분 모니터링
    - [ ] Health check(`/health`) 200 확인
    - [ ] 본인 번호로 production `/sms/send-code` 1회 스모크 (비용 ~35원)

    ## Rollback Plan
    - Infobip 문제 발생 시: Cloud Run 이전 revision으로 롤백 → twilio 환경변수 재주입 필요(이전 revision 기준). 즉, Phase 10 롤백 window는 다음 배포까지 유지.

    ## References
    - [Infobip 2FA API Docs](https://www.infobip.com/docs/2fa-service)
    - CONTEXT.md D-04, D-17
    - RESEARCH.md §"Common Pitfalls > Pitfall 4"
    ```
  </action>
  <acceptance_criteria>
    - `.planning/phases/10-sms/DEPLOY-CHECKLIST.md` 파일 존재
    - 10개 주요 섹션(Portal, KISA, Application, Template, API Key, GCP Secret Manager, GitHub Actions, Cloud Run, Staging Smoke, Production) 전부 포함
    - `grep -q "pinAttempts.*5" .planning/phases/10-sms/DEPLOY-CHECKLIST.md`
    - `grep -q "pinTimeToLive.*3m" .planning/phases/10-sms/DEPLOY-CHECKLIST.md`
    - `grep -q "pinLength.*6" .planning/phases/10-sms/DEPLOY-CHECKLIST.md`
    - `grep -q "pinType.*NUMERIC" .planning/phases/10-sms/DEPLOY-CHECKLIST.md`
    - `grep -q "INFOBIP_API_KEY" .planning/phases/10-sms/DEPLOY-CHECKLIST.md`
    - `grep -q "gcloud secrets" .planning/phases/10-sms/DEPLOY-CHECKLIST.md`
    - `grep -q "TWILIO_.*delete\\|TWILIO_.*Remove\\|Delete.*TWILIO" .planning/phases/10-sms/DEPLOY-CHECKLIST.md`
    - `grep -q "D-04\\|D-17\\|D-25" .planning/phases/10-sms/DEPLOY-CHECKLIST.md`
  </acceptance_criteria>
  <verify>
    <automated>test -f .planning/phases/10-sms/DEPLOY-CHECKLIST.md && grep -q "pinAttempts" .planning/phases/10-sms/DEPLOY-CHECKLIST.md && grep -q "pinTimeToLive" .planning/phases/10-sms/DEPLOY-CHECKLIST.md && grep -q "INFOBIP_API_KEY" .planning/phases/10-sms/DEPLOY-CHECKLIST.md && grep -q "gcloud secrets" .planning/phases/10-sms/DEPLOY-CHECKLIST.md && grep -q "D-1[7]\|D-04" .planning/phases/10-sms/DEPLOY-CHECKLIST.md</automated>
  </verify>
  <requirements>SMS-02, SMS-03</requirements>
  <autonomous>true</autonomous>
  <commit>docs(10-02): add Infobip deploy checklist (KISA, Application, Message Template, secrets rotation)</commit>
  <done>DEPLOY-CHECKLIST.md 작성, 10섹션 전부 커버, Infobip Application 설정값 모두 명시, secrets 로테이션 gcloud 커맨드 포함</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| package.json / lockfile → Wave 1+ 빌드 | 의존성 누락 시 빌드 실패, 추가 실패 시 보안 공급망 리스크 |
| .env.example → production 배포자 | 누락된 env 변수가 있으면 production hard-fail로 catch되지만 배포자 혼선 |
| Infobip 콘솔 설정값 → 코드 기대값 | Application ID나 Message Template 설정값 불일치 시 첫 발송 실패 |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-10-06 | Tampering | supply chain (twilio 제거) | low | accept | `pnpm install --frozen-lockfile`로 lockfile 서명 검증. 제거는 보안상 positive |
| T-10-07 | Information Disclosure | `.env.example` 실 시크릿 포함 위험 | medium | mitigate | acceptance_criteria `! grep -qE "INFOBIP_.*=[a-zA-Z0-9]{8,}"`로 시크릿 유출 방지 |
| T-10-08 | Spoofing | Infobip Application 설정 탈루 | high | mitigate | DEPLOY-CHECKLIST.md 5단계 "API Key 한 번만 노출, 안전한 곳 보관" + GCP Secret Manager 사용 강제(운영 가이드) |
| T-10-09 | Repudiation | secrets 로테이션 누락 | medium | mitigate | DEPLOY-CHECKLIST.md 6·7·8단계로 GCP + GH Actions + Cloud Run 3곳 모두 명시 |

High severity(T-10-08 Infobip key leak)는 DEPLOY-CHECKLIST 운영 지침 + `.env.example`의 빈 값 강제로 완화. 코드 레벨 방어는 Plan 05의 `?.trim()` + hard-fail 검증에서 추가.
</threat_model>

<verification>
- `pnpm install --frozen-lockfile` 성공
- `! grep -q twilio apps/api/package.json`
- `grep -q INFOBIP .env.example`
- `test -f .planning/phases/10-sms/DEPLOY-CHECKLIST.md`
- 전체 typecheck/lint는 RED 허용 (sms.service.ts의 `import Twilio from 'twilio'`가 Plan 05 전까지 남아있음)
</verification>

<success_criteria>
- twilio 의존성 제거 + 2개 패키지 설치
- .env.example INFOBIP_* 4종 문서화 + TWILIO_* 3종 제거
- DEPLOY-CHECKLIST.md로 운영자 수동 작업 10단계 고정
</success_criteria>

<output>
After completion, create `.planning/phases/10-sms/10-02-SUMMARY.md`:
- 변경된 의존성 diff
- .env.example before/after
- DEPLOY-CHECKLIST 섹션 목록
- 후속 plan이 이 기반에서 작업 시작함을 명시
</output>
