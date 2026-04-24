---
status: diagnosed
trigger: "heygrabit.com 프로덕션에서 비밀번호 재설정 요청 시 유저 메일박스에 수신되지 않음"
created: 2026-04-24T09:00:00Z
updated: 2026-04-24T09:18:00Z
phase: 13-grapit-grabit-rename
test: 9
goal: find_root_cause_only
---

## Current Focus

hypothesis: "프로덕션 Cloud Run `grabit-api` 는 Secret Manager `resend-from-email` secret (= `no-reply@grapit.com`, Phase 13 미변경) 을 `RESEND_FROM_EMAIL` 로 주입받는다. Resend 는 이 domain 에 대해 이전에 SPF/DKIM 이 설정돼 있었더라도 (a) `grapit.com` 도메인이 여전히 Resend 에서 verified 여부 + (b) DKIM DNS 레코드가 살아있는지가 불확실 — heygrabit.com 전환 작업이 Resend 콘솔에서 미완 상태이므로 송신 자체가 실패하거나(Hypothesis A: Resend 403/422 → success=false silent) 송신은 성공해도 수신 측에서 SPF/DMARC 불일치로 spam/reject 처리(Hypothesis B)될 가능성이 높다. 두 경로 모두 최종 증상은 '유저가 받지 못함' 으로 동일."
test: "auth.service.ts / email.service.ts 흐름 확인 + HANDOFF.md '현재 grapit.com 기반' 기재 재확인 + deploy.yml `RESEND_FROM_EMAIL=resend-from-email:latest` 바인딩 확인"
expecting: "PROD `from` 값 = `no-reply@grapit.com` (또는 unset 이어서 construction throw 로 container 기동 실패) 중 하나로 수렴"
next_action: "Sentry `grabit-api` 의 최근 에러 이벤트 + Cloud Run log 에서 `Resend send failed for` 또는 constructor throw 확인 (사용자 행동 필요 — gcloud 커맨드 제안)"

## Symptoms

expected: "heygrabit.com 프로덕션에서 비밀번호 재설정 요청 → 유저 메일박스 수신. Subject `[Grabit] 비밀번호 재설정`, sender `no-reply@heygrabit.com`."
actual: "프로덕션환경에서 오지 않음 (silent non-delivery)."
errors: "None reported by user. No visible frontend error."
reproduction: "heygrabit.com 프로덕션에서 유저로 비밀번호 재설정 요청."
started: "Discovered during UAT 2026-04-24, after Phase 13 apex cutover (13-04, 2026-04-23)."

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-24T09:00:00Z
  checked: "Pre-investigation context (13-UAT.md, 13-01-SUMMARY.md, 13-03-SUMMARY.md, STATE.md)"
  found: "Phase 13-01 bulk rename touched email/templates/password-reset.tsx and email.service.spec.ts (no-reply@heygrabit.com ×3). HANDOFF.md marks Resend verified sender heygrabit.com 등록 as pending."
  implication: "Code-side sender was flipped to heygrabit.com, but Resend side may still only trust grapit.com → Resend will reject sends."

- timestamp: 2026-04-24T09:05:00Z
  checked: "apps/api/src/modules/auth/email/email.service.ts (전체 84 lines)"
  found: "from 주소는 env `RESEND_FROM_EMAIL` 에서 읽어온다 (L23). prod 에서 이 값이 없거나 EMAIL_PATTERN 불일치 시 constructor 에서 throw (L40-47). 실제 송신은 `this.resend.emails.send({ from: this.from, ... })` (L70-75) 이고 error 는 throw 하지 않고 `{success:false, error}` return (L77-82) — auth.service.ts L250 의 `await this.emailService.sendPasswordResetEmail(...)` 도 return 값을 사용하지 않음 (void). 즉 Resend 가 4xx 를 내도 **유저에게는 아무 에러도 노출되지 않는다**."
  implication: "'메일이 오지 않음' 은 (a) Resend API 가 silent 실패 (4xx → success=false → 삼킴) 또는 (b) Resend 는 수락했지만 메일박스가 spam/bounce 처리 중 하나. 코드 쪽에서는 유저 메시지/UX 수준에서 성공/실패를 구분할 방법이 없다."

- timestamp: 2026-04-24T09:07:00Z
  checked: ".github/workflows/deploy.yml L120-121 (grabit-api secrets 섹션)"
  found: "`RESEND_API_KEY=resend-api-key:latest` / `RESEND_FROM_EMAIL=resend-from-email:latest` 두 Secret Manager 리소스를 Cloud Run `grabit-api` 에 주입. Phase 13 에서 secret 이름 (`resend-from-email`) / 주입 경로는 변경되지 않았다 (13-03-PLAN.md L605: `DO NOT change RESEND_FROM_EMAIL secret (... Plan 04 에서 결정)` + 13-04-PLAN.md L947: `현재: RESEND_FROM_EMAIL secret 값 유지`)."
  implication: "Secret 값 자체가 바뀌지 않았다는 것은 플랜 명시적으로 동의된 결정. 즉 `grabit-api` 컨테이너 내 env `RESEND_FROM_EMAIL` 은 Phase 9 에서 초기 설정된 값(= `no-reply@grapit.com` 추정) 그대로."

- timestamp: 2026-04-24T09:09:00Z
  checked: ".planning/phases/13-grapit-grabit-rename/HANDOFF.md L163-174, L231-236, L248-250 (운영 서비스 상태 섹션)"
  found: "L172: 'Resend email sender | `grapit.com` 기반 (D-15 이관 대상)'. L233-236: 'Resend verified sender `heygrabit.com` 등록 — 현재: grapit.com 기반 transactional email / 목표: SPF/DKIM/DMARC 를 heygrabit.com 기준으로 재구성'. L248-250: 'grapit.com 자체가 본인 소유인지 여부에 따라 다름' — 즉 grapit.com 도메인 DNS 자체가 프로젝트 소유가 아닐 가능성 존재."
  implication: "런치 직후(2026-04-23 cutover) 시점에서 Resend 콘솔은 여전히 grapit.com 기준으로 운영 중. Phase 13 에서 의도적으로 Resend 콘솔 작업은 D-15 Additional post-phase tasks (EMAIL-VS-01) 로 연기됨. **Resend 콘솔에서 heygrabit.com 도메인 verification 은 아직 수행되지 않았다 = 확정.**"

- timestamp: 2026-04-24T09:11:00Z
  checked: "apps/api/src/modules/auth/auth.service.ts L225-251 (requestPasswordReset 메서드)"
  found: "요청 흐름: `findByEmail → (없거나 passwordHash null이면 silent return) → JWT sign with jwtSecret + user.passwordHash → resetLink 생성 (FRONTEND_URL 기반, Wave 4 에서 https://heygrabit.com 으로 업데이트됨) → emailService.sendPasswordResetEmail(email, resetLink)`. EmailService 의 return 값은 체크하지 않는다 (fire-and-forget)."
  implication: "백엔드 경로는 이메일 템플릿/링크 까지는 올바르게 도달. 실패 지점은 **EmailService 내부의 Resend.emails.send()** 또는 그 이후 메일 deliverability. 코드 레벨에서 검증 가능한 경로는 여기까지."

- timestamp: 2026-04-24T09:13:00Z
  checked: "apps/api/src/modules/auth/email/email.service.ts L40-48 (prod constructor validation)"
  found: "`!fromEmail || !EMAIL_PATTERN.test(fromEmail) → throw` 정책. 즉 프로덕션에서 container 가 기동됐다 = RESEND_FROM_EMAIL 이 비어있지 않고 email regex 에 맞는다 = 어떤 값이든 email 형식을 가진 값이 주입돼 있다. HANDOFF 의 'grapit.com 기반' 서술과 일치시켜 보면 `no-reply@grapit.com` 으로 확정 (또는 유사한 @grapit.com 주소)."
  implication: "Construction throw 경로는 제외 가능 — grabit-api 서비스는 Ready=True (HANDOFF L137). 따라서 EmailService 는 정상 생성되고, 실행 시 Resend API 를 `from=no-reply@grapit.com` 로 호출한다."

- timestamp: 2026-04-24T09:15:00Z
  checked: ".planning/phases/13-grapit-grabit-rename/13-04-PLAN.md L744 (Plan 04 HUMAN-UAT 작성자 본인이 기록한 경고)"
  found: "'From 필드: RESEND_FROM_EMAIL secret 값 (이 시점에서 mailbox는 이전 @grapit.com 또는 @heygrabit.com 로 미설정 상태일 수 있음 — Deferred: Task 6 Additional post-phase tasks 로 이관)'"
  implication: "플랜 작성 시점에 이미 '메일이 안 올 수 있다' 는 사실을 예측하고 있었다. 이번 Test 9 issue 는 **플랜이 미리 경고한 deferred work item 이 표면화된 것**."

## Reasoning Checkpoint

- hypothesis: "프로덕션 `grabit-api` Cloud Run 의 `RESEND_FROM_EMAIL` env 값 = `no-reply@grapit.com` (또는 @grapit.com 주소). Resend 콘솔에서 `heygrabit.com` verification 이 미설정이므로 **Resend 는 `grapit.com` 에 대한 verification 상태에 의존**한다. 두 가지 시나리오:
    (A) Resend 콘솔에서 grapit.com domain 이 여전히 verified 로 남아 있음 → Resend API 수락 → 메일 송신됨 but from=@grapit.com → 수신자 메일함에서 'Grabit'/'heygrabit' 라는 이름을 찾던 유저가 발견하지 못하거나, SPF soft-align 실패로 spam 처리.
    (B) grapit.com 이 더 이상 verified 가 아님 (도메인 소유권 상실 / DNS 레코드 missing) → Resend API 422 (`domain not verified`) 반환 → `email.service.ts` L77 `Resend send failed for ...` log + `{success:false}` return → auth.service.ts 는 return 값 무시 → 유저에게 에러 표시 없음 → UAT 에서 '안옴' 으로 보고됨.
    두 시나리오 모두 직접 원인은 동일: **Resend 콘솔/Secret Manager 에서 heygrabit.com 전환이 완료되지 않았기 때문**."
- confirming_evidence:
  - "HANDOFF.md L172: Resend sender 는 'grapit.com 기반 (D-15 이관 대상)' — 운영자가 직접 기록한 현재 상태"
  - "HANDOFF.md L233-236 + Plan 04 L946-949: `RESEND_FROM_EMAIL` secret 값 교체는 명시적으로 post-phase 로 연기됨 (EMAIL-VS-01)"
  - "13-04-PLAN.md L744: 플랜 저자가 이미 '이 시점에서 mailbox 미설정 상태일 수 있음' 경고를 남김 = 저자가 사전 리스크를 인식"
  - "email.service.ts L77-82 + auth.service.ts L250: Resend 실패는 silent 로 삼켜짐 → 유저 행동 수준에서 '안옴' 과 구별 불가"
  - "deploy.yml L120-121 + Plan 03 L605 + Plan 04 L947: secret 이름/값 모두 Phase 13 에서 변경되지 않음"
- falsification_test: "(유저 또는 orchestrator 가) Cloud Run `grabit-api` log 에서 'Resend send failed for' 로그 검색 → hit 있으면 시나리오 B 확정 / hit 없으면 시나리오 A 확정. 또는 Secret Manager `resend-from-email` 실제 값을 gcloud 로 조회하여 `no-reply@grapit.com` 인지 직접 확인."
- fix_rationale: "root cause 는 '코드 결함' 이 아니라 **운영 cutover 미완**. 수정은 (1) Resend 콘솔에서 heygrabit.com 도메인 추가 + SPF/DKIM/DMARC DNS 레코드 등록 (후이즈) → verified 상태 확보, (2) Secret Manager `resend-from-email` 값을 `no-reply@heygrabit.com` 으로 교체 (gcloud secrets versions add), (3) grabit-api 재배포 (`gh workflow run deploy.yml` 또는 empty commit). 이는 Phase 13 HANDOFF L231-236 에 이미 명시된 계획."
- blind_spots:
  - "본 에이전트는 Sentry/Cloud Run/Resend 콘솔에 접근 불가 — A vs B 시나리오 확정은 유저/orchestrator 의 런타임 증거 필요 (하지만 둘 다 같은 fix path 로 수렴하므로 diagnosis 단계에서는 불필요)"
  - "grapit.com 도메인이 프로젝트 소유인지 확실치 않음 (HANDOFF L248 도 명시적으로 '모름') — 소유라면 Resend verification 만 재확인하면 되지만 미소유라면 `@grapit.com` 기반 발송 자체를 불가능 (시나리오 B 에 가까움)"
  - "Phase 09 런칭 시점에 실제 prod 에서 email 수신이 확인된 적이 있는지 여부 — 09-HUMAN-UAT.md L16 expected 는 있으나 실제 결과 기록은 이 자료만으로는 확인 불가. 만약 Phase 09 당시 prod 수신이 성공했고 지금 실패한다면 무언가 '그 사이' 에 깨졌다는 의미 (예: Resend 도메인 verification 만료, DNS 레코드 drift)."

## Resolution

root_cause: "Phase 13 브랜드 rename 의 **운영(ops) cutover 가 완료되지 않아** Resend 발송 파이프라인이 상한 상태. 구체적으로: (1) Cloud Run `grabit-api` 에 주입되는 `RESEND_FROM_EMAIL` Secret Manager 값은 Phase 9 이후 변경된 적 없는 `no-reply@grapit.com` (Plan 03 decision_constraints L605 + Plan 04 Task 6 L947 로 의도적 deferred), (2) Resend 콘솔에서는 `heygrabit.com` 도메인 verification 이 미수행 (HANDOFF L172, L233-236, Plan 04 L946-948 의 EMAIL-VS-01 이관 항목), (3) `grapit.com` 의 Resend 상태/DKIM DNS 가 현재도 유효한지 여부는 운영 관점에서 검증되지 않음. 결과: Resend API 호출이 (A) 수락되지만 from=@grapit.com 으로 보내 spam 필터링 or 브랜드 불일치로 유저가 식별 실패, 또는 (B) 422 domain-not-verified 로 거부되어 `email.service.ts` L77 에서 silent `{success:false}` 반환. 두 경로 모두 유저 UAT 시점에서는 '안옴' 으로 관측됨. 코드 레벨 결함 아님."
fix: "(find_root_cause_only 모드 — 수정 범위 밖, 권고만 기록) 1) Resend 콘솔에서 heygrabit.com 도메인 추가 + 발급된 SPF/DKIM/DMARC DNS 레코드를 후이즈에 등록 → Verified 상태 확보. 2) `gcloud secrets versions add resend-from-email --data-file=<(printf 'no-reply@heygrabit.com')` (또는 --data-file=-) 로 신규 version 추가. 3) `grabit-api` 재배포 trigger (empty commit 또는 `gcloud run services update grabit-api --region=asia-northeast3 --update-secrets RESEND_FROM_EMAIL=resend-from-email:latest`) 로 신규 revision 적용. 4) verify: `gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=grabit-api AND textPayload:\"Resend send failed\"' --project=grapit-491806 --freshness=1h` empty + UAT 재실행 → mailbox subject `[Grabit] 비밀번호 재설정` from `no-reply@heygrabit.com` 수신."
verification: "find_root_cause_only — 실 fix 및 verification 은 다음 단계(운영/plan-phase --gaps) 범위. 진단 확정을 위해 orchestrator 측에서 실행 권장:
  (1) `gcloud secrets versions access latest --secret=resend-from-email --project=grapit-491806` → 현재 값이 `no-reply@grapit.com` 인지 확인
  (2) `gcloud logging read 'resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"grabit-api\" AND (textPayload:\"Resend send failed\" OR jsonPayload.message:\"Resend send failed\")' --project=grapit-491806 --freshness=24h --limit=10` → 시나리오 A/B 판별
  (3) Resend dashboard (https://resend.com/domains) 에서 grapit.com/heygrabit.com verification 상태 확인
  — 세 증거가 root cause 를 확정 / 시나리오 판별하지만, **fix 경로는 동일** 이므로 진단 완결성에는 영향 없음."
files_changed: []
