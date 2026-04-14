# Phase 9: 기술부채 청산 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 09-tech-debt
**Areas discussed:** 이메일 프로바이더 + dev 모드, 약관 텍스트 관리 방식, Toss 결제 E2E 검증 전략, useShowtimes 처리 + 6건 실행 전략

---

## 이메일 프로바이더 + dev 모드 (DEBT-01)

### Q1. 어느 이메일 프로바이더를 쓰시겠어요?

| Option | Description | Selected |
|--------|-------------|----------|
| Resend (추천) | 현대적 DX, 무료 3,000건/월, React Email 템플릿 지원. 한국 배달률 양호, 설정 간단. 1인 개발 적합 | ✓ |
| SendGrid (Twilio) | 무료 100건/일. Twilio 계정 통합. 한국 배달 실적 오래됨 | |
| AWS SES | 최저가($0.10/1000건). 도메인 검증 + DKIM + 샌드박스 해제 필요. 설정 복잡 | |
| nodemailer + SMTP | Gmail/네이버 SMTP 직접 연동. 프로덕션에서 spam 분류/대량 이슈 위험 | |

**User's choice:** Resend

### Q2. Dev/test 환경에서는 이메일을 어떻게 처리할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| SMS 패턴 똑같이 (추천) | API 키 없으면 자동으로 mock(로그만 출력). 프로덕션에서만 실 발송. 기존 구조와 일관성 | ✓ |
| Ethereal 테스트 이메일 | nodemailer Ethereal로 실제 발송 과정 테스트하되 가짜 설정 | |
| 항상 실제 발송 (.env의 키 사용) | dev에서도 실제 프로바이더 사용. 무료 한도 소모 가능성 | |

**User's choice:** SMS 패턴 똑같이

### Q3. 이메일 템플릿은 어떻게 구성할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| 인라인 문자열 템플릿 | password reset 1건만 시작. 텍스트+간단한 HTML. 추후 업그레이드 | |
| React Email (Resend 공식) | Resend와 first-class 지원. TSX로 템플릿 작성, 미리보기 DX | ✓ |
| 별도 HTML 파일 | apps/api에 templates/ 삽입, handlebars/이종 로더로 로드 | |

**User's choice:** React Email

### Q4. Phase 9에서 이메일 발송 범위는 어디까지 포함할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| Password reset만 (추천) | DEBT-01 요구사항에 정확히 해당. 예매 확인 메일 등은 별도 phase | ✓ |
| + 예매 확인 메일 동시 추가 | 예매 성공 시 의사송 등록 메일. 추가 작업량. Scope creep 위험 | |

**User's choice:** Password reset만

**Notes:** Resend + React Email 조합은 Resend 공식 튜토리얼에서 쌍으로 권장. dev mock 패턴은 Phase 7/8 환경변수 기반 전환 원칙과 완전 일치.

---

## 약관 텍스트 관리 방식 (DEBT-02)

### Q1. 약관 텍스트를 어디에 보관하시겠어요?

| Option | Description | Selected |
|--------|-------------|----------|
| 별도 MD 파일 (추천) | apps/web/content/legal/{terms,privacy,marketing}.md. import해서 렌더링. 법률 검토 후 파일만 교체 | ✓ |
| 현재처럼 인라인 문자열 | TERMS_CONTENT 객체에 그대로 보관. git diff 지저분 | |
| DB에 버전 관리 | terms_versions 테이블 생성, 사용자동의이력까지 추적. MVP 범위 과임 | |

**User's choice:** 별도 MD 파일

### Q2. 약관 초기 텍스트는 어디서 가져오시겠어요?

| Option | Description | Selected |
|--------|-------------|----------|
| 유사 서비스 참고 + Claude 들어원 템플릿 | NOL 티켓 공개 약관 참고 + 각색. "법률 검토 필요" 배너 유지 | |
| 현재 placeholder 그대로 | 법률 자문 후 교체. 구조적 변경만 Phase 9 범위 | |
| 개인정보보호위원회 표준 콘텐츠 | KOPICO 표준 개인정보처리방침 + 티켓 예매 약관 템플릿. 실효성 좀 더 높음 | ✓ |

**User's choice:** 개인정보보호위원회 표준 콘텐츠

### Q3. 약관 변경 이력을 어떻게 추적할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| Git 이력으로 충분 (추천) | MD 파일이면 git log로 변경 이력 남음. 사용자 동의 시점별 버전 추적은 별도 phase | ✓ |
| 엔드포인트/페이지에 버전 문자열 노출 | "약관 v1.0 - 2026-04-14" 표시. 향후 DB 버전링 추가 시 기반마련 | |
| 현재 구조 그대로 (추적 없음) | 약관 교체 시 개별 사용자 재동의는 진행 안 함. 법적 리스크 있을 수 있음 | |

**User's choice:** Git 이력으로 충분

**Notes:** KOPICO(개인정보보호위원회) 표준 개인정보처리방침 양식은 공개 리소스로 법적 기본선 충족에 유리. 실제 법률 검토는 런칭 전 별도 진행.

---

## Toss 결제 E2E 검증 전략 (DEBT-05)

### Q1. Toss 결제 E2E 검증을 어떤 방식으로 구성할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| Toss sandbox + SDK 실연동 E2E (추천) | 테스트 카드로 실제 SDK 렌더 후 결제 플로우 완주. 실전 회귀 방지 가장 강력 | ✓ |
| Toss SDK 모킹 E2E | window.__toss__ 모킹으로 위젯 어테프트. CI 안정적이나 실 SDK 홍수 검출 불가 | |
| 수동 UAT 체크리스트만 | 테스트 기록이 아닌 호 수동 운영 사이클. "검증 완료" 기준 미충족 | |

**User's choice:** Toss sandbox + SDK 실연동 E2E

### Q2. E2E 테스트 커버리지는 어디까지 포함할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| Happy path + 주요 실패 1-2건 (추천) | 성공(예매부터 완료) + 사용자 결제 취소 + 카드 실패. 기본 회귀 방지 | ✓ |
| Happy path만 | 성공 플로우 1건만. 엣지 케이스 회귀 검출 불가 | |
| 전체 Toss 시나리오 커버 | 모든 결제수단 + 모든 에러. 과임, 유지보수 부담 증가 | |

**User's choice:** Happy path + 주요 실패 1-2건

### Q3. CI에서 E2E는 언제 실행할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| PR + main push에서 (추천) | 기존 social-login.spec.ts 패턴. env 게이팅으로 TOSS_TEST_CLIENT_KEY 없으면 skip | ✓ |
| 수동 트리거 (workflow_dispatch) | 필요 시 수동 실행. CI 시간 절약하나 회귀 높칠 위험 | |
| Nightly 슬롯 (cron) | 매일 정기 실행. PR 랜더 없음 | |

**User's choice:** PR + main push에서

### Q4. Toss 테스트 키는 어디서 관리할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions secrets + 로컬 .env (추천) | TOSS_CLIENT_KEY_TEST / TOSS_SECRET_KEY_TEST 별도 관리. 프로덕션 키 오전송 차단 | ✓ |
| Toss 공식 테스트 키 하드코딩 | 문서 공개 테스트 키를 repo에 고정. 설정 간단하나 올라갈 수 있음 | |

**User's choice:** GitHub Actions secrets + 로컬 .env

**Notes:** Toss 샌드박스는 실제 Toss 서버에 테스트 요청을 보내므로 부하가 걸릴 수 있음. CI 동시 실행 시 rate limit 확인 필요 (planner 단계에서 Toss 문서 확인).

---

## useShowtimes 처리 + 6건 실행 전략 (DEBT-06 + 전체 실행 순서)

### Q1. useShowtimes 훅과 호출부를 어떻게 처리할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| 훅 + 호출부 전체 삭제 (추천) | booking-page가 이미 performance.showtimes로 fallback 중. 안전하게 제거 가능 | ✓ |
| 엔드포인트 /performances/:id/showtimes 구현 | 중복 엔드포인트 생성. 공연 상세 API에 showtimes 있어 불필요 | |
| 훅을 usePerformanceDetail 앨리어스로 안내 | 훅에서 performance.showtimes 반환하도록 재구성. 복잡도 증가 | |

**User's choice:** 훅 + 호출부 전체 삭제

### Q2. 6건을 몇 개 plan으로 묶을까요?

| Option | Description | Selected |
|--------|-------------|----------|
| 3 plans (기능별 그룹핑) (추천) | Plan 1: 03+04+06(빠른 정리). Plan 2: 01+02(이메일+약관). Plan 3: 05(E2E). 각 독립적 | ✓ |
| 6 plans (1건당 1 plan) | 완전히 독립적이나 오버헤드. 3-4건은 1-2시간 분량 | |
| 2 plans (대규모 vs 소규모) | Plan 1: 03/04/06. Plan 2: 01/02/05. 미단위 atomic 성격 약화 | |

**User's choice:** 3 plans (기능별 그룹핑)

### Q3. 6건에 실행 순서도 중요한가요?

| Option | Description | Selected |
|--------|-------------|----------|
| 빠른 정리 먼저(03/04/06) → 외부 연동 나중(01/02/05) (추천) | 작은 성공 쌓아 초록 CI 확보 후 외부 의존. 1인 개발 리듬에 적합 | ✓ |
| 중요도 순서 (DEBT-01 이메일 → DEBT-05 → 나머지) | 사용자 영향 중요도 기준. 복잡한 것부터 처리하니 momentum 확보 어려움 | |
| 순서 상관없음 - 병렬 실행 가능 | 독립적이라 병렬. 1인 개발에서 실익 미미 | |

**User's choice:** 빠른 정리 먼저(03/04/06) → 외부 연동 나중(01/02/05)

### Q4. DEBT-03 좌석맵 테스트 회귀는 실제로 행동이 어떤상태여야 할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| 다른 회원이 잠금 중인 좌석 클릭 시 토스트로 안내 (추천) | 현재 테스트 의도와 일치. onSeatClick 호출 후 parent에서 toast | ✓ |
| 클릭 자체를 차단 (onSeatClick 호출 안 함) | sold와 동일 처리. 피드백 없어 사용자 혼란 가능성 | |

**User's choice:** 다른 회원이 잠금 중인 좌석 클릭 시 토스트로 안내

**Notes:** 현재 테스트가 실제로 실패 중인지 planner 단계에서 `pnpm --filter @grapit/web test seat-map-viewer`로 확인 후 fix 방향 결정.

---

## Claude's Discretion

- Resend 환경변수 네이밍 (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)
- React Email 템플릿 파일 위치 및 내부 스타일
- `EmailService` 프로바이더 구조 및 mock 분기 로직
- KOPICO 표준 기반 Grapit 약관 실 문안
- Toss E2E에서 실 SDK 로딩 vs page.route() 인터셉션 비율
- DEBT-03 테스트 회귀 원인 진단 후 구체 fix 방법
- formatDateTime 시그니처 변경 이후 호출부 리팩터링 범위
- Plan 1/2/3의 commit 분할 세부 기준

## Deferred Ideas

- 예매 확인 메일 — 별도 phase
- 사용자별 약관 동의 시점 버전 추적 — 법적 요구 발생 시 별도 phase
- 약관 문안의 법률 자문 반영 — 런칭 전 전문가 검토
- /performances/:id/showtimes 전용 엔드포인트 — 현재 perf detail로 충분
- Sold 좌석 toast 안내 — Phase 12 UX 현대화 범위
- Toss E2E 모든 결제수단 커버 — 별도 작업
