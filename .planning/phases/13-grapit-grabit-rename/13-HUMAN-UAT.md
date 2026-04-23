# Phase 13 — HUMAN-UAT (Wave 4 apex cutover checklist)

**Planned:** 2026-04-23
**Cutover target time:** 2026-04-23 (immediate — user requested skip of 7-day observation)
**Executor:** Sangwoo Park
**Rollback script:** `scripts/rollback-cutover.sh`
**D-09 (Revision 2):** OAuth callback SoT = `https://api.heygrabit.com/api/v1/auth/social/{provider}/callback`

**Revision 3 note (Wave 3 decision carryover):** asia-northeast3 Cloud Run domain-mappings 은 UNIMPLEMENTED 이므로 apex 경로도 Global External HTTPS LB + Serverless NEG + URL Map host-based routing 으로 구현됨. 본 checklist 의 "domain-mapping" 단어는 실제로 LB 스택의 URL Map host rule + SSL cert 발급을 의미.

## Pre-Cutover (T-30min)

- [x] Plan 03 완료 확인: 새 Cloud Run 서비스 `grabit-api` + `grabit-web` status=True
- [x] 새 서비스 health check green (직접 .run.app URL로 curl 200)
- [x] **D-09:** `curl -sI https://api.heygrabit.com/api/v1/health` 200 확인 (Wave 3 에서 설정됨)
- [x] `.gitignore` 에 `rollback.yaml` 엔트리 존재 확인 (`git check-ignore -q rollback.yaml` exit 0)
- [x] `./scripts/rollback-cutover.sh capture` 실행 → `rollback.yaml` 생성
- [x] `git status` 출력에 `rollback.yaml` 이 untracked/modified 로 표기되지 않음 확인 (gitignore 적용 증거)
- [x] Sentry 새 프로젝트에 이벤트 수신 확인 (Wave 3 D-12 검증에서 event ID `86c6c59...` / `44e8230...` 수신)
- [ ] off-peak 시간대 확인 + (옵션) 사용자 공지

## Cutover (T-0, apex LB 확장)

- [ ] Step 1: grabit-web Serverless NEG 생성 (asia-northeast3)
- [ ] Step 2: grabit-web Backend Service (global, EXTERNAL_MANAGED) + NEG attach
- [ ] Step 3: Google-managed SSL cert 생성 (`heygrabit.com` + `www.heygrabit.com`)
- [ ] Step 4: URL Map host rules 추가 (`api.heygrabit.com` → api-matcher, `heygrabit.com`/`www.heygrabit.com` → web-matcher)
- [ ] Step 5: Target HTTPS Proxy 에 grabit-web-cert 추가 첨부 (SNI 공존)
- [ ] Step 6: 후이즈 DNS — `heygrabit.com` apex A → `34.117.215.31`, `www` A → `34.117.215.31` 추가 (사용자 수동)
- [ ] Step 7: SSL cert poll — 최대 30분 대기 (ACTIVE 될 때까지)
- [ ] Step 8 (D-09 apex): `curl -sI https://heygrabit.com/ | head -1` → `HTTP/2 200`
- [ ] Step 9 (D-09 www): `curl -sI https://www.heygrabit.com/ | head -1` → `HTTP/2 200`
- [ ] Step 10 (D-09 api): `curl -sI https://api.heygrabit.com/api/v1/health | head -1` → `HTTP/2 200` (유지)

## Post-Cutover Re-deploy (T+15min)

- [ ] GitHub variable `CLOUD_RUN_WEB_URL` → `https://heygrabit.com` 갱신
- [ ] CI re-run → Deploy re-trigger → Cloud Run env 반영 (`FRONTEND_URL=https://heygrabit.com`, `NEXT_PUBLIC_API_URL=https://api.heygrabit.com` build-arg)
- [ ] 재배포 완료 후 `gcloud run services describe grabit-api` env 의 FRONTEND_URL 확인
- [ ] 재배포 완료 후 `gcloud run services describe grabit-web` build-arg 확인 (latest revision)

## OAuth Callback (이미 Wave 3 에서 병행 등록 완료)

- [x] 카카오: `https://api.heygrabit.com/api/v1/auth/social/kakao/callback` 등록됨 (Wave 3)
- [x] 네이버: `https://api.heygrabit.com/api/v1/auth/social/naver/callback` 등록됨 (Wave 3)
- [x] 구글: `https://api.heygrabit.com/api/v1/auth/social/google/callback` 등록됨 (Wave 3)

## User-Facing Verification (T+30min)

- [ ] 카카오 로그인 E2E 성공 (`heygrabit.com` 에서 로그인 → 가입자 정보 확인)
- [ ] 네이버 로그인 E2E 성공
- [ ] 구글 로그인 E2E 성공
- [ ] 비밀번호 재설정 요청 → 수신 이메일 subject `[Grabit] 비밀번호 재설정` 확인 (실제 mailbox)
- [ ] 회원가입 SMS OTP 요청 → 수신 SMS body `[Grabit] 인증번호 XXXXXX (3분 이내 입력)` 확인 (실제 단말)
- [ ] Sentry 새 프로젝트 (grabit-api, grabit-web) 에 prod 트래픽 이벤트 수신 확인

## Rollback Trigger Conditions (any failing → run rollback.sh restore)

- SSL cert `grabit-web-cert` status 가 30분 이상 `PROVISIONING` 지속
- `https://heygrabit.com/` 이 지속적으로 5xx
- OAuth provider 3종 중 로그인 완전 중단 (3종 모두)
- 즉시 `./scripts/rollback-cutover.sh restore` 실행 → URL Map host rule 제거 + Target HTTPS Proxy 에서 grabit-web-cert 분리 → api-only 상태로 복귀

**Rollback 후 재시도:** 문제 진단 → LB 확장 재실행 (새 cutover 시간 확정)

## Grace Period — Cleanup (cutover 후 7일, D-14 hard gate 준수)

- [ ] 7일 유예 기간 동안 grabit-* 서비스 장애/롤백 요청 없음 확인
- [ ] `gcloud logging read` 로 구 grapit-* 서비스에 최근 24h 트래픽 0건 확인
- [ ] **D-14 (LB-adapted):** `./scripts/cleanup-old-grapit-resources.sh $(gcloud config get-value project) --confirm-after-date YYYY-MM-DD` 실행 (YYYY-MM-DD 는 cutover 날짜 + 7일 이상)
- [ ] 확인: `gcloud run services list --region=asia-northeast3 | grep grapit-` → empty
- [ ] 확인: `gcloud artifacts repositories list --location=asia-northeast3 | grep grapit` → empty
- [ ] OAuth 3종 콘솔에서 구 run.app callback URL 삭제 (한 번에 3곳 진행)
- [ ] `rollback.yaml` 로컬 파일 수동 삭제 (`rm rollback.yaml`) — cutover 성공 7일 경과 후 더 이상 불필요

## Sign-Off

- **Cutover executor:** _________________ (date: ________)
- **UAT pass:** _________________ (date: ________)
- **7-day cleanup (`--confirm-after-date=YYYY-MM-DD`):** _________________ (date: ________)
