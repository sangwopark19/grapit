# Roadmap: Grapit

## Milestones

- ✅ **v1.0 MVP** -- Phases 1-5 (shipped 2026-04-09)
- 🚧 **v1.1 안정화 + 고도화** -- Phases 6-12 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) -- SHIPPED 2026-04-09</summary>

- [x] Phase 1: Foundation + Auth (5/5 plans) -- completed 2026-03-30
- [x] Phase 2: Catalog + Admin (6/6 plans) -- completed 2026-03-31
- [x] Phase 3: Seat Map + Real-Time (4/4 plans) -- completed 2026-04-02
- [x] Phase 4: Booking + Payment (3/3 plans) -- completed 2026-04-07
- [x] Phase 5: Polish + Launch (5/5 plans) -- completed 2026-04-08

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### 🚧 v1.1 안정화 + 고도화 (In Progress)

**Milestone Goal:** 인프라 안정화(Redis->Valkey 전환, R2 연동, 기술부채 청산, SMS 실연동)를 완료하고, 어드민 고도화 및 UX 현대화로 서비스 품질을 끌어올린다.

- [ ] **Phase 6: 소셜 로그인 버그 수정** - 소셜 로그인 재로그인 실패 버그 해결 (전제 조건)
- [ ] **Phase 7: Valkey 마이그레이션** - Upstash Redis 제거, ioredis 단일 클라이언트로 Google Valkey 전환
- [ ] **Phase 8: R2 프로덕션 연동** - Cloudflare R2 키 발급부터 CDN 서빙까지 프로덕션 파일 스토리지 완성
- [ ] **Phase 9: 기술부채 청산** - v1.0에서 누적된 stub/회귀/미검증 6건 해소
- [ ] **Phase 10: SMS 인증 실연동** - dev mock을 실제 SMS 발송/검증으로 전환
- [ ] **Phase 11: 어드민 대시보드** - 통계 대시보드 + Valkey 캐싱으로 어드민 고도화
- [ ] **Phase 12: UX 현대화** - 디자인 트렌드 반영 + SVG 좌석맵 UX 개선

## Phase Details

### Phase 6: 소셜 로그인 버그 수정
**Goal**: 카카오/네이버/구글 소셜 로그인 사용자가 로그아웃 후 재로그인할 수 있다
**Depends on**: Nothing (v1.1 첫 번째 phase, v1.0 Phase 5 완료 상태)
**Requirements**: AUTH-01
**Success Criteria** (what must be TRUE):
  1. 소셜 로그인으로 가입한 사용자가 로그아웃 후 동일 소셜 계정으로 재로그인 성공
  2. 카카오, 네이버, 구글 세 프로바이더 모두에서 재로그인 동작 확인
  3. 재로그인 후 기존 사용자 데이터(예매 내역 등)가 정상 연결
**Plans:** 2 plans
Plans:
- [x] 06-01-PLAN.md -- 백엔드 버그 수정 + 에러 핸들링 + 프론트엔드 에러 UI
- [x] 06-02-PLAN.md -- E2E 테스트 + 수동 검증

### Phase 7: Valkey 마이그레이션
**Goal**: Upstash Redis 제거, ioredis 단일 클라이언트로 Google Memorystore for Valkey에 연결하여 인프라를 단순화한다
**Depends on**: Phase 6
**Requirements**: VALK-01, VALK-02, VALK-03, VALK-04, VALK-05, VALK-06
**Success Criteria** (what must be TRUE):
  1. 좌석 잠금(SET NX + TTL)이 Valkey에서 정상 동작하고 10분 후 자동 해제
  2. Socket.IO 실시간 좌석 동기화가 Valkey pub/sub로 동작 (다중 인스턴스 포함)
  3. 공연 카탈로그 캐시가 Valkey에서 서빙되어 DB 직접 조회 대비 응답 시간 단축
  4. Cloud Run에서 Valkey로의 VPC 연결이 안정적으로 유지
  5. Lua 스크립트 3개(좌석 잠금/해제/상태 조회)가 ioredis eval() 시그니처로 정상 실행
**Plans:** 5 plans
Plans:
- [x] 07-01-PLAN.md -- @upstash/redis 제거 + ioredis 단일 provider 통합 + eval() 시그니처 변환
- [x] 07-02-PLAN.md -- 공연 카탈로그 캐시 레이어 구현 (CacheService + 무효화)
- [x] 07-03-PLAN.md -- GCP Memorystore 프로비저닝 + Cloud Run VPC Egress 설정
- [x] 07-04-PLAN.md -- 리뷰 피드백 1차: production REDIS_URL hard-fail + invalidate try/catch + adapter duplicate 옵션 + release gate 문서화
- [x] 07-05-PLAN.md -- 리뷰 피드백 2차: HealthController Valkey ping + testcontainers 실 Valkey 통합 테스트

### Phase 8: R2 프로덕션 연동
**Goal**: 포스터/SVG 좌석맵 파일이 Cloudflare R2에 업로드되고 CDN을 통해 빠르게 서빙된다
**Depends on**: Phase 7
**Requirements**: R2-01, R2-02, R2-03, R2-04
**Success Criteria** (what must be TRUE):
  1. 관리자가 포스터 이미지와 SVG 좌석맵을 업로드하면 R2 버킷에 저장
  2. 업로드된 파일이 커스텀 도메인 CDN URL로 접근 가능
  3. 브라우저에서 CORS 에러 없이 이미지/SVG 로딩 (AllowedHeaders 명시적 설정)
  4. 기존 로컬/임시 파일 참조가 R2 URL로 완전 교체
**Plans:** 3 plans
Plans:
- [x] 08-01-PLAN.md -- S3Client forcePathStyle 추가 + 검증 테스트
- [x] 08-02-PLAN.md -- Next.js remotePatterns + Dockerfile + deploy.yml R2 시크릿
- [ ] 08-03-PLAN.md -- R2 인프라 설정 (버킷/CORS/토큰) + 업로드 플로우 검증

### Phase 9: 기술부채 청산
**Goal**: v1.0에서 누적된 stub, 테스트 회귀, 미검증 항목을 해소하여 코드베이스 신뢰도를 확보한다
**Depends on**: Phase 8
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04, DEBT-05, DEBT-06
**Success Criteria** (what must be TRUE):
  1. 비밀번호 재설정 시 실제 이메일이 발송되고 링크를 통해 비밀번호 변경 완료
  2. 회원가입 시 이용약관 dialog에 실제 약관 텍스트가 표시
  3. 전체 테스트 스위트가 0 failure로 통과 (locked seat click 회귀 포함)
  4. Toss Payments 결제 플로우가 E2E로 검증 완료
  5. 타입 경고 0건 + 미사용 라우트 정리 완료
**Plans:** 3 plans
Plans:
- [x] 09-01-PLAN.md -- Quick cleanup (DEBT-03 toast 일원화 + DEBT-04 formatDateTime + DEBT-06 useShowtimes 제거)
- [x] 09-02-PLAN.md -- Terms + Email (DEBT-02 MD 약관 + DEBT-01 Resend EmailService)
- [x] 09-03-PLAN.md -- Toss E2E (DEBT-05 Playwright + CI secrets + D-13 격리)

### Phase 09.1: CI-login-E2E — Playwright login helper 가 POST /auth/login 에 body 를 전달하지 못해 401 을 받는 이슈 조사 및 해결 (INSERTED)

**Goal:** CI 환경에서만 발생하는 Playwright loginAsTestUser helper → POST /api/v1/auth/login 401 이슈의 근본 원인을 규명·해결하여 `toss-payment.spec.ts` 의 3개 test.fixme 를 복구하고 CI 에서 12/12 green 을 달성한다
**Requirements**: none (urgent tech-debt, no REQ-ID mapping)
**Depends on:** Phase 9
**Plans:** 5/5 plans complete

Plans:
- [x] 09.1-01-PLAN.md — Wave 0 진단 인프라: env-gated debug middleware + main.ts rawBody + CI DEBUG_AUTH_REQ env 주입
- [x] 09.1-02-PLAN.md — Wave 1 증거 수집: CI 에서 curl + Playwright probe 양쪽 AUTH_LOGIN_DEBUG 로그 캡처 + 원인 범주(A/B/C) checkpoint 결정
- [x] 09.1-03-PLAN.md — Wave 2 조건부 fix: 확정된 분기(A=native fetch / B=headers 교정 / C=server-side) 중 단일 적용
- [x] 09.1-04-PLAN.md — Wave 3 복구: toss-payment.spec.ts 의 3 test.fixme → test 복구 + CI 12/12 green 증거 (S4)
- [x] 09.1-05-PLAN.md — Wave 4 정리: 진단 미들웨어/env/probe 완전 제거 + Phase 09 VERIFICATION deferred closure

### Phase 10: SMS 인증 실연동
**Goal**: 회원가입 시 실제 SMS OTP가 발송되고 인증번호 검증으로 본인 확인이 완료된다
**Depends on**: Phase 9
**Requirements**: SMS-01, SMS-02, SMS-03, SMS-04
**Success Criteria** (what must be TRUE):
  1. 회원가입 시 입력한 전화번호로 실제 SMS OTP가 수신
  2. 동일 번호/IP에서 과도한 SMS 요청 시 rate limiting 적용
  3. OTP 입력 실패 횟수 초과 또는 만료 시 재발송 필요
  4. 개발 환경에서는 SMS mock 모드가 자동 적용되어 실제 발송 없이 테스트 가능
**Plans:** 7/9 plans executed
Plans:
- [x] 10-01-PLAN.md — Wave 0 테스트 스캐폴딩 + Infobip fixture (RED)
- [x] 10-02-PLAN.md — twilio 제거 + Infobip deps + .env.example + DEPLOY-CHECKLIST
- [x] 10-03-PLAN.md — parseE164 + isChinaMainland (libphonenumber-js/min, CN edge cases)
- [x] 10-04-PLAN.md — Infobip 2FA native fetch wrapper + InfobipApiError
- [x] 10-05-PLAN.md — SmsService Infobip 재작성 + Lua atomic counter + cooldown rollback + hard-fail
- [x] 10-06-PLAN.md — @Throttle IP axis + zod 국제 번호 + 429 response 통일
- [x] 10-07-PLAN.md — ThrottlerModule forRootAsync + Valkey storage + password-reset D-09
- [x] 10-08-PLAN.md — phone-verification 4-state + 30s 쿨다운 + HTTP 에러 카피 + 국제 번호
- [x] 10-09-PLAN.md — E2E + testcontainers integration + staging smoke (체크리스트)

### Phase 11: 어드민 대시보드
**Goal**: 관리자가 대시보드에서 예매/매출/장르 통계를 한눈에 파악하고 운영 의사결정을 내릴 수 있다
**Depends on**: Phase 10
**Requirements**: ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-06
**Success Criteria** (what must be TRUE):
  1. 관리자가 /admin 대시보드에서 오늘의 예매 수, 매출, 취소 건수, 활성 공연 수를 확인
  2. 일별/주별 매출 추이를 area chart로 시각화하여 트렌드 파악 가능
  3. 장르별 예매 분포(donut)와 결제수단 분포(bar)가 차트로 표시
  4. 인기 공연 Top 10 랭킹이 표시되어 운영 우선순위 판단 가능
  5. 통계 쿼리 결과가 Valkey에 캐싱되어 대시보드 로딩이 빠름
**Plans**: TBD
**UI hint**: yes

### Phase 12: UX 현대화
**Goal**: 전체 디자인을 모던 트렌드에 맞게 개선하고 SVG 좌석맵 사용성을 높여 사용자 경험을 끌어올린다
**Depends on**: Phase 11
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06
**Success Criteria** (what must be TRUE):
  1. 전체 UI가 모던 디자인 트렌드를 반영하여 시각적으로 개선
  2. SVG 좌석맵에서 스테이지 방향이 명확히 표시되고 등급별 색상 범례 + 가격이 보임
  3. 좌석 선택/해제 시 자연스러운 애니메이션 전환
  4. 줌 상태에서 미니맵으로 현재 위치 파악 가능
  5. 모바일에서 좌석 터치 타겟이 최소 44px로 보장되어 오탭 방지
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation + Auth | v1.0 | 5/5 | Complete | 2026-03-30 |
| 2. Catalog + Admin | v1.0 | 6/6 | Complete | 2026-03-31 |
| 3. Seat Map + Real-Time | v1.0 | 4/4 | Complete | 2026-04-02 |
| 4. Booking + Payment | v1.0 | 3/3 | Complete | 2026-04-07 |
| 5. Polish + Launch | v1.0 | 5/5 | Complete | 2026-04-08 |
| 6. 소셜 로그인 버그 수정 | v1.1 | 0/2 | Planning | - |
| 7. Valkey 마이그레이션 | v1.1 | 3/5 | Executing | - |
| 8. R2 프로덕션 연동 | v1.1 | 0/3 | Planning | - |
| 9. 기술부채 청산 | v1.1 | 0/0 | Not started | - |
| 10. SMS 인증 실연동 | v1.1 | 7/9 | In Progress|  |
| 11. 어드민 대시보드 | v1.1 | 0/0 | Not started | - |
| 12. UX 현대화 | v1.1 | 0/0 | Not started | - |
