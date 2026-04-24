# Phase 14 HUMAN-UAT — SMS OTP CROSSSLOT fix

**Created:** 2026-04-24
**Goal:** 배포 후 프로덕션 `heygrabit.com` 에서 실기기로 회원가입 SMS OTP 인증이 정상 성공하는지 검증하고, D-17 72시간 Sentry 관측 창을 닫는다.

**Pre-conditions (코드 측 필요 완료 상태):**
- [ ] Plan 01 merged (sms.service.ts hash-tag 적용 + 4 export + 두 spec 파일 stale key 갱신 — REVIEWS.md HIGH#2)
- [ ] Plan 02 merged (sms-throttle.integration.spec.ts drift 제거)
- [ ] Plan 03 merged (sms-cluster-crossslot.integration.spec.ts 5 시나리오 green + dynamic natMap — REVIEWS.md MEDIUM#4)
- [ ] Plan 03 merged (`.github/workflows/ci.yml` 에 `pnpm --filter @grabit/api test:integration` step 추가 — REVIEWS.md HIGH#1)
- [ ] Plan 04 Task 1-2 merged (phone-verification.tsx + test 녹색, generic `message?: string` optional — REVIEWS.md LOW#6)
- [ ] `pnpm --filter @grabit/api test && pnpm --filter @grabit/api test:integration && pnpm --filter @grabit/web test` 전체 green
- [ ] **[MEDIUM#5] GitHub Actions CI 녹색:** 이 phase 의 PR (main 대상) 에서 `check` job 이 green finalize. 특히 `Integration tests (testcontainers — SC-2 Valkey Cluster CROSSSLOT guard)` step 이 success. ci.yml 에서 `pnpm --filter @grabit/api test:integration` 이 PR 에서 실제로 실행되어 녹색이어야 함.
- [ ] GitHub Actions deploy.yml → Cloud Run `grabit-api` 새 revision 이 ACTIVE
- [ ] GitHub Actions deploy.yml → Cloud Run `grabit-web` 새 revision 이 ACTIVE

---

## SC-1: 프로덕션 실기기 회원가입 SMS 인증 성공 (LOCKED D-20)

**Scenario reproduces Phase 13 UAT gap 10 (D-21):** 이전에 이 시나리오는 `CROSSSLOT` 로 인해 "틀린 인증번호" 메시지로 masking 됐다. 이번 배포 이후 정상 성공해야 한다.

**Steps:**
1. 실제 휴대폰(iOS 또는 Android 실기기) 으로 `https://heygrabit.com/signup` 접속
2. 회원가입 3단계 (전화번호 인증) 에서 **실제 수신 가능한 번호** 입력 → "인증번호 발송" 클릭
3. SMS 수신 확인 — 문구: `[Grabit] 인증번호 NNNNNN (3분 이내 입력)`
4. 수신한 6자리 코드 입력 → "확인" 클릭
5. **Expected:** 4단계 (비밀번호 설정) 로 진행됨. 에러 메시지 없음.
6. 만약 실패 시:
   - 에러 문구가 "인증번호가 일치하지 않습니다" 인가? → **REGRESSION** (D-07 fallback 이 잘못 발동) → 롤백 준비
   - 에러 문구가 "인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요." 인가? → 시스템 에러 여전 → Sentry 확인 후 롤백

**체크리스트:**
- [ ] SMS 수신 시간 < 30s
- [ ] 코드 입력 후 성공 응답 시간 < 2s
- [ ] 에러 alert 미표시
- [ ] 회원가입 완료까지 진행

---

## D-17: Sentry 72h CROSSSLOT 0-occurrence (배포 overlap 분리 — REVIEWS.md LOW#7)

**Purpose:** hash-tag 수정이 100% 적용돼 어떤 e164 포맷으로도 CROSSSLOT 이 재발하지 않음을 확증.

**[REVIEWS.md LOW#7] Window 정의 재조정:**
- Sentry 72h zero-count window 는 **새 API revision 이 100% traffic 을 받고 + 최소 15분 drain 경과 이후 시점부터 카운트 시작** 한다.
- 그 전(= 0% → 100% traffic 전환 진행 중 + drain 15분 이내)에 발생한 CROSSSLOT 이벤트는 **overlap 이벤트로 분류**하고 72h window 계산에서 제외한다.
- Overlap 이벤트는 별도 라벨로 기록하되, D-17 pass/fail 판정에는 반영하지 않는다. 이는 배포 cutover 중 기존 revision 의 in-flight 요청이 구 코드 경로로 남는 정상 현상을 false-negative 없이 처리하기 위함.

**Steps:**
1. 배포 시작 시각 기록: ________________ (ISO8601)
2. **100% traffic 도달 시각** 기록 (Cloud Run 콘솔 → Revisions → Traffic allocation 100% 확인): ________________
3. **15분 drain 종료 시각** 기록 (100% traffic 시각 + 15분): ________________ ← 이 시점부터 72h window 시작
4. Sentry → `grabit-api` 프로젝트 → Issues 검색: `event.type:error message:"CROSSSLOT"`
5. 72h window 동안의 누적 카운트 (위 Step 3 시각 이후):
   - [ ] 0 건 (PASS)
   - [ ] 1+ 건 (FAIL → 즉시 알림 + 재조사)
6. Overlap 이벤트 카운트 (배포 시작 ~ Step 3 사이): ________________ (참고용, pass/fail 무관)
7. 72h window 종료 시각: ________________
8. Sentry 쿼리 최종 스크린샷을 이 파일에 첨부(옵션) 또는 SUMMARY 에 포함

---

## D-19: 배포 overlap 5분 UX 관측

**Purpose:** 키 스킴이 한 번에 전환되는 cutover 에서 기존 in-flight OTP 를 가진 사용자가 새 revision 에 도달해도 service level impact 가 최소임을 확인.

**Steps:**
1. Cloud Run 콘솔 → `grabit-api` → Logs → 배포 시각 ± 5분 윈도 필터
2. `sms.sent` 카운트 vs `sms.verify_failed` (주의: 이 카운트는 자연 발생하는 오타 실패도 포함) 비율 관측
3. **Acceptance:** `sms.verify_failed` 카운트가 배포 직전 1시간 평균보다 **<2×** 상승에 그친다 (15분 drain 창 내 자연 과도 상태)
4. **Red flag:** `sms.verify_failed` 가 5× 이상 급증 → 기존 OTP 를 가진 사용자들이 집단적으로 실패 → 마이그레이션 스크립트 없이 즉시 전환한 D-19 가정에 대한 압력. 대응: CLI 로 `redis-cli --scan --pattern "sms:otp:*"` 실행해 잔존 키 개수 확인, 2-3분 더 관측 후 자연 drain 확인.

---

## Sign-off

- [ ] SC-1 체크리스트 PASS
- [ ] D-17 72h 관측 0 CROSSSLOT (**100% traffic + 15분 drain 이후 기준**, overlap 제외 — REVIEWS.md LOW#7)
- [ ] D-19 5분 overlap 관측 정상
- [ ] **[MEDIUM#5] ci.yml `test:integration` step 이 이 phase PR 에서 green finalize 확인**
- [ ] 검증자: ____________________
- [ ] 완료 날짜: ____________________
- [ ] `.planning/STATE.md` 의 Phase 14 상태를 "shipped (code+prod UAT)" 로 업데이트

---

**Rollback 기준:**
- SC-1 실패 (틀린 인증번호 메시지 노출 + SMS 인증 재현 가능) → 즉시 이전 revision 으로 롤백 (`gcloud run services update-traffic grabit-api --to-revisions=<previous>=100`)
- D-17 중 (100% traffic + 15분 drain 경과 후) CROSSSLOT 1건 이상 발생 → 원인 조사 후 롤백 여부 결정
