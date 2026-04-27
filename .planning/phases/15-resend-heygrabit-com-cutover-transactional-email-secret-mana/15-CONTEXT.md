# Phase 15: Resend heygrabit.com cutover — Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

프로덕션 `grabit-api`의 transactional email 발송 도메인을 `grapit.com`에서 `heygrabit.com`으로 실제 운영 cutover 한다. 범위:

1. Resend 콘솔에서 `heygrabit.com` 도메인 등록 및 verification
2. 후이즈 DNS에 SPF / DKIM / DMARC 레코드 등록
3. Secret Manager `resend-from-email` 값을 `no-reply@heygrabit.com`으로 교체
4. `grabit-api` Cloud Run 서비스에 신규 Secret version을 적용 (즉시 재배포)
5. 운영 검증 (Cloud Run log + Resend dashboard) 및 3사 UAT 수신 확인
6. Silent failure 관측성 개선 — `email.service.ts` Resend 실패 시 Sentry `captureException` 명시 호출
7. Resend 콘솔에서 구 `grapit.com` 도메인 제거 (heygrabit.com verified 이후)

**In scope (locked):** Resend 도메인·DNS·Secret·재배포·검증·관측성
**Out of scope (locked):** Infobip SMS sender ID `Grabit` KISA 등록 (별도 운영 항목, KISA 심사 블로커), `legal@heygrabit.com` 실제 메일박스 개설 (별도 MX 설계 필요), auth.service.ts fire-and-forget 의 client-surfaced 에러 노출 (enumeration 방어 세맨틱 유지)

Root-cause 진단은 `.planning/debug/password-reset-email-not-delivered-prod.md` 에 이미 완료 — 이 phase 는 그 진단에서 도출된 수정 경로를 실행하는 운영 중심 phase. 코드 변경은 최소 (observability 1 plan).

</domain>

<decisions>
## Implementation Decisions

### Scope
- **D-01:** Resend only — Infobip 및 legal mailbox 는 이번 phase 에서 제외. 두 항목은 각각 KISA 심사 블로커(Infobip), MX 설계·메일박스 provider 선택(legal mailbox) 을 수반하므로 blast radius 와 UAT 복잡도를 분리한다.

### Old domain handling
- **D-02:** `heygrabit.com` Verified 상태 확인 후 Resend 대시보드에서 구 `grapit.com` 도메인 제거. 실수로 `@grapit.com` 발송 경로가 살아있을 가능성을 차단하며, `grapit.com` 도메인 소유권 여부(HANDOFF L248 에서 미확정) 에 의존하지 않는 깔끔한 상태로 수렴시킨다. 제거는 UAT 수신 확인 이후에 수행.

### DNS (후이즈)
- **D-03:** SPF TXT 레코드 `v=spf1 include:_spf.resend.com ~all` — Resend 단일 발송 경로, soft-fail. 향후 Google Workspace 나 다른 발송 인프라가 추가되면 `include:` 항목을 확장할 여지 보존.
- **D-04:** DMARC TXT 레코드 `v=DMARC1; p=none; rua=mailto:sangwopark19icons@gmail.com` — 초기 관찰 모드. Aggregate report 를 개인 Gmail 로 수집해 1~2 주 후 pass 비율이 95%+ 를 기록하면 별도 phase/운영 항목으로 `p=quarantine` 승격. `dmarc@heygrabit.com` 메일박스는 legal mailbox phase 전까지 미존재이므로 개인 Gmail 로 우회.
- **D-05:** DKIM 은 Resend 가 제공하는 기본 selector CNAME 레코드 (`resend._domainkey.heygrabit.com` CNAME `<resend 제공값>`) 그대로 등록. 별도 backup selector 는 준비하지 않음 — key rotation 은 Resend 가 관리.
- **D-06:** DNS propagation 확인은 `dig +short TXT heygrabit.com` / `dig +short CNAME resend._domainkey.heygrabit.com` 로 수동 점검. Resend 콘솔의 Verified 상태가 reliable 지표이므로 그걸 primary signal 로 사용.

### Secret Manager
- **D-07:** `gcloud secrets versions add resend-from-email --data-file=<(printf 'no-reply@heygrabit.com')` 로 신규 version 을 추가. 구 version (`no-reply@grapit.com`) 은 삭제하지 않고 **유지** — rollback 시 version 번호 지정으로 즉시 복귀 가능하게 함.
- **D-08:** Secret 교체 트리거는 DNS 가 후이즈에 반영되고 **Resend 콘솔에서 `heygrabit.com` Verified 가 확인된 이후**에만 수행. 검증 전에 Secret 을 먼저 교체하면 Resend 가 422 domain-not-verified 로 거절하여 silent failure 가 폭주한다.

### Redeploy
- **D-09:** 즉시 재배포는 `gcloud run services update grabit-api --region=asia-northeast3 --update-secrets RESEND_FROM_EMAIL=resend-from-email:latest` 로 수행. deploy.yml CI 전체 pipeline 을 돌리지 않는다 — Phase 15 는 secret rotation 성격이고 코드 변경은 별도 plan 으로 분리되기 때문에 CI 실행은 그 plan 커밋에서 자연 유발된다.
- **D-10:** 재배포 후 최소 1 분 wait 후 `gcloud run services describe grabit-api ...` 로 새 revision 이 active 상태인지 (traffic 100%) 확인.

### Observability — Silent failure remediation
- **D-11:** `apps/api/src/modules/auth/email/email.service.ts` L77-82 의 `logger.error` 는 유지하되, 바로 다음 줄에 `@sentry/nestjs` 의 `Sentry.captureException(error, { tags: { component: 'email-service', from: this.from } })` 호출을 추가한다. 코드 변경 규모: 5~10 라인, plan 1 개.
- **D-12:** `auth.service.ts:250` 의 `await this.emailService.sendPasswordResetEmail(...)` 는 **수정하지 않는다** — 현재 코드의 fire-and-forget 구조는 enumeration 방어 세맨틱 (존재하지 않는 이메일과 존재하는 이메일 요청이 동일하게 200 을 반환) 을 지탱하고 있어 return 값을 client 에 노출하면 이 보호막이 깨진다. 대신 server-side observability (D-11) 로 운영자가 실패를 인지.

### Verification
- **D-13:** 운영 검증 = `gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="grabit-api" AND (textPayload:"Resend send failed" OR jsonPayload.message:"Resend send failed")' --project=grapit-491806 --freshness=24h --limit=10` 실행 결과가 empty **AND** Resend 대시보드 Sent/Delivered stat 이 최근 UAT 발송을 기록 — 두 조건이 모두 만족해야 D-13 PASS.
- **D-14:** UAT 수신 검증 = Gmail + Naver + Daum(또는 Kakao) 3 사 각각 `/auth/forgot-password` 를 프로덕션에서 트리거해 실제 inbox (spam 폴더 아님) 에 `[Grabit] 비밀번호 재설정` / from `no-reply@heygrabit.com` 수신 확인. 3 사 중 하나라도 spam 분류되면 DKIM/SPF alignment 검토로 diversion.

### Rollback
- **D-15:** Rollback playbook 범위는 Secret Manager version pinning 만. 문제 발생 시 `gcloud run services update grabit-api --region=asia-northeast3 --update-secrets RESEND_FROM_EMAIL=resend-from-email:<previous_version_number>` 로 30 초 내에 복귀. DNS 레코드 revert 는 propagation 시간(3~24 시간) 때문에 fast rollback 수단이 될 수 없으므로 playbook 에 포함하지 않음 — 대신 Secret 복귀 후 debug session 개시.

### Audit trail
- **D-16:** `15-HUMAN-UAT.md` 에 실행 로그 축적: (a) Resend 대시보드에서 heygrabit.com Verified 전환 시각, (b) 후이즈 DNS SPF/DKIM/DMARC 등록 시각 + `dig` 확인 결과, (c) Secret Manager 새 version 번호, (d) 신규 Cloud Run revision ID, (e) 3 사 UAT 수신 시각 및 스크린샷 링크. Phase 13/14 HUMAN-UAT 패턴 계승.

### Claude's Discretion
- Plan 구성 wave 수, plan 별 task 분해 기준, `Sentry.captureException` 의 정확한 tags/contexts 스키마
- `dig` / `gcloud` 명령어 정확한 flag 세트 (Phase 13/14 pattern 참조)
- HUMAN-UAT 양식 세부 (screenshot 링크 vs 텍스트 로그)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Root cause diagnosis (authoritative)
- `.planning/debug/password-reset-email-not-delivered-prod.md` — 진단 완료된 root cause 문서. 수정 경로·검증 커맨드·두 가지 실패 시나리오(A: send 성공 but spam, B: 422 domain-not-verified) 모두 서술. Phase 15 는 이 문서의 Resolution 섹션을 실행.

### Phase 13 handoff (deferred items origin)
- `.planning/phases/13-grapit-grabit-rename/HANDOFF.md` §3.4 L172 (Resend sender 현황), §4 🔵 L231-236 (Resend verified sender 재등록 TODO), §3.5 L184 (DNS provider = 후이즈)
- `.planning/phases/13-grapit-grabit-rename/13-03-PLAN.md` L605 — `DO NOT change RESEND_FROM_EMAIL secret (Plan 04 결정)` 명시적 deferred 표기
- `.planning/phases/13-grapit-grabit-rename/13-04-PLAN.md` L744, L946-949 — Plan 04 작성자 본인이 남긴 "mailbox 미설정 가능 경고" + EMAIL-VS-01 이관 기록
- `.planning/phases/13-grapit-grabit-rename/13-CONTEXT.md` — Phase 13 의 D-15 (이메일/SMS sender 운영 이관 항목)

### Affected code
- `apps/api/src/modules/auth/email/email.service.ts` — Production hard-fail 패턴, `this.from = fromEmail`, Resend `{data, error}` 분기 (L70-82). Sentry captureException 추가 지점.
- `apps/api/src/modules/auth/auth.service.ts` L225-251 — `requestPasswordReset` fire-and-forget. **수정 대상 아님** (enumeration 방어 의도적).
- `apps/api/src/modules/auth/email/email.service.spec.ts` — email.service.ts Sentry 통합 후 spec 업데이트.

### Infra binding
- `.github/workflows/deploy.yml` L118-124 — `RESEND_FROM_EMAIL=resend-from-email:latest` secret 주입 라인. Phase 15 는 이 줄을 수정하지 않고 Secret Manager 내부 version 만 교체.

### Project decision lineage
- `.planning/PROJECT.md` "Phase 13 완료 (2026-04-23)" / "Phase 14 완료 (2026-04-24)" 요약 + Key Decisions 표 (Production REDIS_URL hard-fail 패턴 = email hard-fail 패턴의 legal ancestor)

### External docs (read before DNS or Resend work)
- Resend docs (Context7): domain verification flow + SPF/DKIM/DMARC 권장 값 (planner 에서 `mcp__plugin_context7_context7__query-docs` 로 최신 값 확인)
- 후이즈 (whoisdomain.kr) DNS 콘솔: TXT/CNAME 레코드 수동 입력 UI — 문서 공개 URL 없음, 운영자가 웹 콘솔로 직접 수행

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`EmailService` (email.service.ts)**: 이미 production hard-fail + dev mock 분기가 완성돼 있어 from 값 교체만으로 cutover 완결. Sentry 추가 1 포인트.
- **Phase 14 `[Grabit]` subject / `no-reply@heygrabit.com` 리터럴**: Phase 13-01 에서 이미 rename 완료. 이번 phase 는 런타임 env 값만 교체.
- **Phase 13 `HANDOFF.md` 형식**: Phase 15 의 `HUMAN-UAT.md` 형식 참조 모델 (운영 상태·외부 서비스·Rollback 섹션 구조 승계).

### Established Patterns
- **Production hard-fail for env misconfig**: Phase 7 REDIS_URL, Phase 10 INFOBIP_API_KEY, email.service.ts L30-47 동일 패턴. Phase 15 에서 코드 추가 시 이 패턴 이탈 금지.
- **Sentry in NestJS**: `@sentry/nestjs` v10 이 Phase 1~ 에 이미 설치됨 (PROJECT.md Tech stack). `Sentry.captureException(error, {tags, contexts})` 호출 양식은 기존 모듈 (예: apps/api/src/main.ts 또는 다른 service 에 있는 경우) 에서 참조.
- **Secret rotation without pipeline**: Quick tasks `260420-cd7` / `260420-ci-toss-secrets-restore` 에서 `gcloud secrets versions add` + `gcloud run services update` 조합 수행 전례. 해당 SUMMARY 참조 가능.

### Integration Points
- **`gcloud run services update grabit-api`**: `--update-secrets RESEND_FROM_EMAIL=resend-from-email:latest` 만 변경. 다른 secret 바인딩 (`DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `INFOBIP_*`, 등) 은 건드리지 않음.
- **Cloud Run min-instances=0**: 신규 revision 은 첫 요청 시 cold start 발생. UAT 트리거 자체가 cold start 를 유발하므로 운영상 추가 조치 불필요.

### Non-negotiable constraints
- **GCP project ID `grapit-491806`**: Phase 13 D-01 로 불가역 고정. Phase 15 의 `gcloud` 명령어는 전부 이 프로젝트 대상.
- **Region `asia-northeast3`**: Phase 3 배포 결정. 모든 `gcloud run` 명령어에 `--region=asia-northeast3`.
- **후이즈 NS**: DNS 는 후이즈 관리 (Phase 13 HANDOFF §3.5). Cloud DNS 나 Cloudflare DNS 로 이전 시도 없음.

</code_context>

<specifics>
## Specific Ideas

- Debug 문서의 Resolution 섹션(L88-93) 에 있는 정확한 `gcloud` 커맨드는 Phase 15 plan 의 task action 에 그대로 전재할 수 있음 (단, `:latest` 는 version 명시로 다듬기).
- UAT mailbox 3 사 선정 이유: Gmail 은 국제 deliverability 기준, Naver 는 한국 최다 이메일 유저, Daum/Kakao 는 카카오 생태계 유저 — 한국 tx email 운영에서 검증 공분산을 극대화하는 최소 조합.
- DMARC `rua=mailto:sangwopark19icons@gmail.com` 은 임시 경로 — 향후 `legal@heygrabit.com` mailbox 가 생기면 reliable 수신처로 재할당.
- Phase 13 Plan 03/04 에 "의도적 deferred" 표기가 있었기 때문에, Phase 15 는 그 deferred 를 정산하는 구조로 CONTEXT/PLAN 에 그 lineage 를 명시하여 Phase 15 의 존재 이유를 자체 문서화.

</specifics>

<deferred>
## Deferred Ideas

### To separate phase/operational item
- **Infobip SMS sender ID `Grabit` KISA 등록**: Phase 13 HANDOFF L238-241. KISA 심사 블로커 때문에 phase 가 아닌 개별 운영 항목으로 별도 관리.
- **`legal@heygrabit.com` 실제 mailbox 개설**: MX 레코드 설계 + provider 선택 (Google Workspace / Zoho / Resend inbound) + legal 문서 재확인 — Phase 16 (Legal pages launch) 전후로 재검토.
- **DMARC `p=quarantine` 승격**: 1~2 주 aggregate report 관찰 후 pass 95%+ 확인 시 별도 quick/phase 에서 수행.
- **`grapit.com` DNS / 이메일 도메인 처리**: Phase 13 HANDOFF L248-250. 도메인 소유권 여부 불확실 → 본 phase 범위 밖 (Resend 대시보드에서 제거하는 것은 단지 Resend 측 상태일 뿐 grapit.com DNS 자체를 건드리지 않음).

### To future observability phase
- **auth.service.ts return-value aware error surfacing**: fire-and-forget 은 enumeration 방어에 필수이므로 수정하지 않지만, 운영자용 admin dashboard 같은 곳에서 최근 이메일 실패 count 를 표시하는 별도 구조 (예: Sentry → Cloud Monitoring alert) 는 향후 고려.

</deferred>

---

*Phase: 15-resend-heygrabit-com-cutover-transactional-email-secret-mana*
*Context gathered: 2026-04-24*
