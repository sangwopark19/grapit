---
phase: 15
reviewers: [codex]
reviewers_attempted: [codex, cursor, claude]
reviewers_skipped:
  - reviewer: claude
    reason: SELF_CLI — running inside Claude Code CLI
  - reviewer: cursor
    reason: "cursor agent login 미완료 (Authentication required)"
reviewers_unavailable: [gemini, coderabbit, opencode, qwen]
reviewed_at: 2026-04-24T08:21:49Z
plans_reviewed:
  - 15-01-PLAN.md
  - 15-02-PLAN.md
  - 15-03-PLAN.md
---

# Cross-AI Plan Review — Phase 15

> **Note on reviewer count:** Claude Code 내부에서 실행되어 `claude` 는 self-skip, `cursor` 는 로그인 미완료, `gemini/coderabbit/opencode/qwen` 은 로컬 미설치 상태라 이번 라운드는 **Codex 단독 리뷰**다. 교차 합의(consensus)는 단일 리뷰어 범위로 제한되므로, 후속 라운드에서 `cursor agent login` 또는 `gemini` 설치 후 재실행하는 것을 권장한다.

---

## Codex Review

### Overall Summary

전체적으로 Phase 15의 목표인 `no-reply@heygrabit.com` cutover, Resend domain verification, Secret Manager rotation, Cloud Run redeploy, 3사 UAT, Sentry 관측성 확보까지 필요한 큰 흐름은 잘 잡혀 있다. 다만 실행 안전성 관점에서 **Plan 03이 Plan 01을 hard dependency로 걸지 않은 점**, **`grapit.com` 제거 후 rollback playbook이 사실상 깨지는 점**, **password reset UAT에 등록된 계정이 필요하다는 전제가 누락된 점** 은 반드시 보완해야 한다.

### 15-01-PLAN.md

#### Summary

Plan 01은 범위가 작고 명확하다. `email.service.ts` 의 Resend error branch에만 Sentry 관측성을 추가하고, `auth.service.ts` 의 enumeration 방어 구조를 유지하는 방향이 적절하다. 테스트도 Error wrapping, PII masking, success/dev path non-call을 확인하도록 설계되어 있다.

#### Strengths

- `auth.service.ts` fire-and-forget semantics 를 수정 금지로 명확히 둔 점이 좋다.
- Sentry에 full email address 대신 `toDomain` 만 기록하는 PII masking 방향이 적절하다.
- Resend SDK의 plain error object를 `new Error(...)` 로 감싸 stack trace 를 보전하는 결정이 타당하다.
- 기존 `sms.service.ts` 의 `Sentry.withScope` 패턴을 재사용해 코드 스타일 일관성이 좋다.
- DEV / PROD success path 에서 Sentry가 호출되지 않는 회귀 방어가 포함되어 있다.

#### Concerns

- **LOW:** plan 내부에서 기존 테스트 개수가 "5개" 와 "6개" 로 섞여 있다. 실행에는 큰 문제는 아니지만 acceptance wording 이 흔들릴 수 있다.
- **LOW:** `grep -c "try {"` acceptance는 파일 전체에 future unrelated `try` 가 생기면 false fail을 만들 수 있다.
- **LOW:** Sentry block 주석이 다소 길어질 수 있다. 코드에는 한두 줄이면 충분하다.
- **LOW:** 기존 `logger.error` 는 여전히 full `to` 를 기록한다. 이번 phase 의 Sentry PII masking 요구는 충족하지만, logging PII 정책과는 별개로 남는다.

#### Suggestions

- 테스트 개수 표현을 "기존 N개 + 신규 2개" 로 실제 파일 기준에 맞춰 정리.
- `try/catch 금지` 검증은 grep 보다 diff review 기준으로 두는 편이 낫다.
- 주석은 "auth.service intentionally swallows result for enumeration defense; capture here for ops visibility." 정도로 줄여도 충분.
- 향후 별도 observability/security task 에서 `logger.error` 의 full email logging 도 domain-only 또는 hash 로 낮추는 것 검토.

#### Risk Assessment

**LOW.** 단일 service branch 와 spec 변경에 국한되어 있고, failure mode 도 테스트로 대부분 방어된다.

---

### 15-02-PLAN.md

#### Summary

Plan 02 는 Resend domain verification 과 후이즈 DNS 등록을 운영 runbook 으로 잘 분리했다. 특히 "Resend dashboard 가 발급한 값을 그대로 등록" 하도록 한 점은 핵심 리스크를 잘 잡았다. 다만 검증 command 가 여전히 특정 record name/type 을 가정하는 부분과, `15-HUMAN-UAT.md` 를 수동 작업 후에 생성하는 순서는 보완 여지가 있다.

#### Strengths

- Secret rotation 전에 Resend Verified 를 hard gate 로 둔 점이 매우 중요하고 적절하다.
- CONTEXT 의 오래된 SPF/DKIM 가정값보다 Resend dashboard 발급값을 우선하도록 명시한 점이 좋다.
- 후이즈 DNS 작업에서 기존 A record 를 건드리지 말라는 경계가 명확하다.
- `dig` 결과와 Resend 원본값을 audit log 에 side-by-side 로 남기려는 설계가 좋다.
- 구 `grapit.com` 을 Plan 02 에서 제거하지 않도록 한 sequencing 이 안전하다.

#### Concerns

- **MEDIUM:** `depends_on: []` 라서 Plan 01 배포 전에도 Plan 02 가 진행될 수 있다. DNS verification 자체는 안전하지만, 이후 Plan 03 이 Plan 01 없이 진행될 가능성을 열어둔다.
- **MEDIUM:** "SPF MX + SPF TXT + DKIM TXT + DMARC TXT" 를 고정된 형태처럼 표현한다. Resend 가 record shape 를 바꾸거나 selector 를 여러 개 발급하면 plan 의 hardcoded `dig` command 가 부정확해질 수 있다.
- **MEDIUM:** `dig +short TXT resend._domainkey.heygrabit.com` 처럼 selector 를 고정한다. 실제 Resend dashboard 가 다른 DKIM selector/name 을 줄 경우 executor 가 혼란을 겪을 수 있다.
- **LOW:** `15-HUMAN-UAT.md` 가 Task 4 에서 생성되어 Task 1~3 의 수동 기록이 로컬 메모에 의존한다. 운영 중 값 누락 가능성이 있다.
- **LOW:** DMARC 는 Resend "발급값" 이라기보다 D-04 에 따라 운영자가 정의하는 값이다. 문구가 약간 혼재되어 있다.

#### Suggestions

- Plan 02 는 병렬 가능하더라도, Plan 03 에는 반드시 `depends_on: [01, 02]` 를 걸어야 한다.
- `dig` 검증은 hardcoded host 대신 "Resend 발급 table 의 각 row 에 대해 `dig +short <TYPE> <NAME>` 실행" 으로 일반화.
- DKIM 은 `resend._domainkey` 단일 selector 를 가정하지 말고 Resend dashboard 의 `Name` column 을 source of truth 로 삼는다.
- `15-HUMAN-UAT.md` 는 Task 0 에서 먼저 생성하고, Task 1~3 이 그 파일에 즉시 기록하도록 바꾸면 audit trail 손실 위험이 줄어든다.
- DMARC 항목은 "Resend required records" 와 "project-defined DMARC record" 로 분리해 쓰는 편이 정확.

#### Risk Assessment

**MEDIUM.** DNS/Resend verification 자체는 잘 설계됐지만, record shape 가정과 audit 기록 순서가 운영 실수 가능성을 남긴다.

---

### 15-03-PLAN.md

#### Summary

Plan 03 은 실제 cutover 단계로 필요한 작업을 대부분 포함하고 있다. Secret 신규 version 추가, Cloud Run revision 생성, UAT, logging/Sentry 확인, Resend old domain cleanup 흐름은 맞다. 하지만 이 plan 에는 운영상 큰 구멍이 몇 개 있다. 특히 **Plan 01 미의존**, **등록된 UAT 계정 전제 누락**, **`grapit.com` 제거 후 rollback 불능** 은 실행 전 수정해야 한다.

#### Strengths

- Secret 추가 후 read-back 검증을 넣은 점이 좋다.
- Cloud Run `--update-secrets` 후 revision 100% traffic 확인을 UAT 전 gate 로 둔 점이 적절하다.
- Gmail/Naver/Daum 3사 UAT 와 spam 미분류 조건을 명확히 둔 점이 좋다.
- `gcloud logging read` + Resend dashboard + Sentry 를 중복 관측 신호로 보는 설계가 안전하다.
- DNS revert 를 rollback 수단으로 쓰지 않는 결정은 맞다.

#### Concerns

- **HIGH:** `depends_on: [02]` 만 있다. Plan 01 이 merge/deploy 되지 않아도 secret cutover 가 가능해져 CUTOVER-04 가 충족되지 않을 수 있다.
- **HIGH:** UAT 메일 주소가 prod 에 등록된 사용자 계정이어야 한다는 전제가 없다. password reset flow 가 enumeration 방어를 위해 미등록 이메일에도 200 을 반환한다면, 미등록 Gmail/Naver/Daum 주소로는 메일이 발송되지 않아 false fail 이 난다.
- **HIGH:** Task 5 에서 `grapit.com` 을 Resend 에서 제거하면, 이후 D-15 rollback 인 `RESEND_FROM_EMAIL=resend-from-email:<previous_version>` 은 `no-reply@grapit.com` 으로 돌아가므로 실패할 가능성이 크다. "30초 rollback" 은 Task 5 이후에는 성립하지 않는다.
- **MEDIUM:** Cloud Logging query 가 revision 또는 cutover timestamp 로 필터링되지 않아, cutover 이전 24h 의 과거 `Resend send failed` 로그가 false fail 을 만들 수 있다.
- **MEDIUM:** Secret previous version 식별이 `versions list --limit=5` 에 의존한다. 명시적 sort/filter 가 없으면 rollback pin 기록이 부정확할 수 있다.
- **MEDIUM:** Resend dashboard 의 `Delivered` stat 은 provider/webhook 상태에 따라 항상 신뢰 가능한 gate 가 아닐 수 있다. 실제 inbox 수신이 확인되면 `Sent` + inbox evidence 로 충분할 수 있다.
- **LOW:** `:latest` 바인딩은 운영 중 동시 secret version 추가가 있으면 auditability 가 약해진다. 가능하면 신규 version 번호를 명시적으로 pin 하는 쪽이 더 재현 가능.
- **LOW:** STATE.md / ROADMAP.md 업데이트가 ship 판정에 언급되지만 task 에는 포함되어 있지 않다.

#### Suggestions

- Plan 03 frontmatter 를 `depends_on: [01, 02]` 로 바꾸고, Task 1 pre-gate 에 "Plan 01 code deployed to Cloud Run revision 확인" 을 hard gate 로 추가.
- UAT precondition 에 "Gmail/Naver/Daum 각각 prod 에 가입된 테스트 계정이어야 함" 을 추가. 없으면 먼저 회원가입 또는 admin seed 절차를 넣어야 한다.
- `grapit.com` 제거는 최소 24h 또는 72h 안정 관측 후 별도 cleanup task 로 미루는 것을 권장. 즉시 제거가 locked 라면 rollback 문구를 "Task 5 이전까지만 30초 rollback 가능" 으로 수정.
- Logging query 에 cutover revision 또는 timestamp 필터를 추가. 예: `resource.labels.revision_name="<new_revision>"` 또는 `timestamp >= "<cloud_run_update_time>"`.
- previous version 조회는 `--filter='state=ENABLED' --sort-by='~createTime' --limit=1` 처럼 명시적으로 작성.
- Secret update 는 가능하면 `RESEND_FROM_EMAIL=resend-from-email:<new_version>` 로 명시 pin 을 고려. deploy.yml 의 `latest` 와 운영 runbook 의 pin 전략이 충돌하지 않도록 결정 기록도 남긴다.
- Phase 완료 task 에 `STATE.md` / `ROADMAP.md` 업데이트 또는 별도 `/gsd-verify-work` handoff 를 명확히 추가.

#### Risk Assessment

**HIGH before fixes, MEDIUM after fixes.** Secret rotation 과 live email deliverability 를 건드리는 운영 cutover 이고, 현재 rollback 설명이 old domain 제거 후 상태와 충돌한다. 위 HIGH 항목을 보완하면 실행 리스크는 관리 가능한 MEDIUM 수준으로 내려간다.

---

## Consensus Summary

단일 리뷰어(Codex) 라 엄밀한 의미의 consensus 는 아니지만, 같은 항목에 대해 Plan 간 평가가 일치하거나 여러 증거가 같은 결론을 가리키는 경우를 모아 정리한다. 추후 2차 reviewer 가 합류하면 이 섹션을 교차 검증하여 업데이트한다.

### Agreed Strengths (Codex 전반 일관)

- Plan 01 의 범위 축소 (email.service.ts 만, auth.service 보존) 가 안전한 설계.
- Plan 02 의 Resend dashboard 발급값 우선 정책 + hard gate (Verified) 로 secret rotation 의 선결 조건이 잘 잡힘.
- Plan 03 의 Secret read-back, Cloud Run revision 100% traffic 확인, 3사 UAT + 복합 관측(logging + Sentry + Resend dashboard) 구조.

### Agreed Concerns (실행 전 반드시 검토)

1. **[HIGH] Plan 03 의존성 누락** — `depends_on: [02]` 만 걸려 있어 Plan 01 미배포 상태에서도 cutover 가능. `depends_on: [01, 02]` 로 교정하고 pre-gate 에 "Plan 01 deployed revision 확인" 추가 필요.
2. **[HIGH] UAT 계정 전제 누락** — password reset 은 미등록 이메일에도 200 을 반환(enumeration defense). Gmail/Naver/Daum UAT 주소가 prod 등록 계정이어야 mail 발송. Precondition 에 명시 + 누락 시 admin seed 절차 필요.
3. **[HIGH] `grapit.com` 제거와 30초 rollback 충돌** — Task 5 에서 old domain 제거 시 이전 secret version (`no-reply@grapit.com`) 으로 복귀하는 D-15 rollback 이 실패. 해결책 A: 24~72h 안정 관측 후 별도 cleanup, 해결책 B: rollback 문구를 "Task 5 이전까지만 30초 rollback 가능" 으로 수정 + 이후 구간의 대체 rollback (새로운 Sender 설정) 정의.
4. **[MEDIUM] DKIM selector / record shape hardcoding** — Plan 02 의 `dig +short TXT resend._domainkey.heygrabit.com` 등 고정 selector 가 Resend dashboard 실제 발급값과 다를 수 있음. "dashboard table row 기준 generic loop" 로 일반화 권장.
5. **[MEDIUM] Cloud Logging query 필터 부족** — Plan 03 의 "empty result" gate 는 cutover 이전 과거 로그로 false fail 발생 가능. `resource.labels.revision_name` 또는 `timestamp >= cutover_time` 필터 추가.
6. **[MEDIUM] Secret previous version 식별 모호** — `versions list --limit=5` 는 sort 없으면 rollback pin 기록 부정확. `--filter='state=ENABLED' --sort-by='~createTime' --limit=1` 명시화.
7. **[MEDIUM] HUMAN-UAT 생성 순서** — Plan 02 Task 4 에서 생성되지만 Task 1~3 중 감시값이 필요. Task 0 에서 shell 만들기.
8. **[LOW] STATE/ROADMAP 업데이트 누락** — 완료 task 에 포함되어 있지 않음.

### Divergent Views

2차 reviewer (cursor/gemini) 가 합류하기 전까지 N/A. 특히 아래 두 항목은 2차 의견이 유용하다:

- `:latest` secret binding vs. explicit version pin (Codex 는 명시 pin 선호, deploy.yml 현재는 `:latest`).
- `grapit.com` 제거 시점 — 즉시 vs. 24/72h 유예.

---

## Action Items for Re-plan (우선순위)

- [ ] **[HIGH]** Plan 03 frontmatter `depends_on: [01, 02]` 로 변경 + Task 1 pre-gate 에 "Plan 01 배포 revision 확인" 삽입.
- [ ] **[HIGH]** Plan 03 UAT precondition 에 "Gmail/Naver/Daum prod 등록 계정" 명시. 없으면 회원가입 또는 admin seed 서브태스크 추가.
- [ ] **[HIGH]** Plan 03 Task 5 `grapit.com` 제거와 D-15 rollback 문구 충돌 해소 — cleanup 분리 또는 rollback 시점 명시.
- [ ] **[MEDIUM]** Plan 02 `dig` 검증 루프를 "Resend dashboard 발급 table row 별 generic" 로 재작성.
- [ ] **[MEDIUM]** Plan 03 Cloud Logging query 에 cutover revision 또는 timestamp 필터 추가.
- [ ] **[MEDIUM]** Plan 03 previous secret version 조회를 `--filter=state=ENABLED --sort-by=~createTime --limit=1` 로 명시화.
- [ ] **[MEDIUM]** Plan 02 Task 0 에서 `15-HUMAN-UAT.md` shell 먼저 생성.
- [ ] **[LOW]** Plan 01 acceptance 의 테스트 개수 표현 통일 (기존 5 vs 6) + `grep try {` 대신 diff review 명시.
- [ ] **[LOW]** Plan 03 에 `STATE.md` / `ROADMAP.md` 업데이트 task 추가 또는 `/gsd-verify-work` handoff 명시.

다음 단계:
```
/gsd-plan-phase 15 --reviews
```
를 실행해 위 action item 을 plan 에 반영한다. 2차 reviewer 확보 시:
```
cursor agent login       # 또는 brew install gemini-cli 등
/gsd-review --phase 15 --all
```
로 재실행해 consensus 를 강화한다.
