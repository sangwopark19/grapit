# Phase 9: 기술부채 청산 - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

v1.0에서 누적된 6건의 기술부채(DEBT-01 ~ DEBT-06)를 해소하여 코드베이스 신뢰도를 확보한다. 6건은 다음 3개 기능 그룹으로 묶인다:

1. **빠른 정리 (DEBT-03/04/06):** 테스트 회귀, 타입 경고, dead code 정리
2. **외부 서비스 연동 (DEBT-01/02):** Password reset 이메일 실구현, 이용약관 실제 텍스트
3. **결제 플로우 E2E 검증 (DEBT-05):** Toss Payments sandbox E2E 자동화

경계 외:
- 예매 확인 메일 등 password reset 외 이메일 기능 추가 (별도 phase)
- 사용자 동의 시점 기준 약관 버전 추적 (법적 요구 발생 시 별도 phase)
- /performances/:id/showtimes 신규 엔드포인트 구현 (현재 performance detail로 충분)
- SVG/좌석맵 UX 개선 전반 (Phase 12 UX 현대화 범위)

</domain>

<decisions>
## Implementation Decisions

### 이메일 발송 (DEBT-01)
- **D-01:** 이메일 프로바이더는 **Resend** 채택 — 1인 개발 DX, 무료 3,000건/월, React Email 1st-party 지원, 한국 배달률 양호
- **D-02:** dev/test 환경은 기존 SMS 패턴과 동일하게 env 기반 mock — `RESEND_API_KEY` 미설정 시 console.log로 대체, 프로덕션에서만 실제 발송
- **D-03:** 이메일 템플릿은 **React Email** 사용 — `@react-email/components` 기반 TSX 템플릿, Resend SDK와 공식 통합
- **D-04:** Phase 9 범위는 **password reset 이메일만** — 예매 확인 메일 등 추가 기능은 별도 phase로 분리 (scope creep 방지)
- **D-05:** `auth.service.ts:217-241`의 `requestPasswordReset` 메서드의 `console.log(...)` stub (L240)을 Resend 호출로 교체, `EmailService` 프로바이더를 auth 모듈에 주입

### 이용약관/개인정보처리방침 (DEBT-02)
- **D-06:** 약관 텍스트는 **별도 Markdown 파일**로 분리 — `apps/web/content/legal/{terms-of-service,privacy-policy,marketing-consent}.md`, `?raw` import로 정적 포함
- **D-07:** 초기 텍스트는 **개인정보보호위원회(KOPICO) 표준 개인정보처리방침 + 표준 티켓 예매 약관 템플릿**을 기반으로 Grapit용 각색. 법률 검토 문구("법률 검토 전 교체 필요")는 배너 형태로 잠시 유지
- **D-08:** 버전 추적은 **Git 이력으로 충분** — 사용자별 동의 시점 버전 추적은 Phase 9 범위 외 (MD 파일 변경 이력은 git log로 확인 가능)
- **D-09:** `signup-step2.tsx:22-38`의 `TERMS_CONTENT` 인라인 placeholder 객체를 MD 파일 import 구조로 교체

### Toss Payments E2E (DEBT-05)
- **D-10:** E2E 방식은 **Toss sandbox + 실 SDK 연동** — Toss 공식 테스트 카드(4242-...)로 실제 SDK 로딩/위젯 렌더링/결제 승인 플로우 전 과정 검증
- **D-11:** 커버리지는 **happy path + 실패 1-2건** — (1) 카드 결제 성공→예매 완료, (2) 사용자가 결제창 취소, (3) 카드 승인 거절 (잘못된 카드). 모든 결제수단 커버는 과잉
- **D-12:** CI 트리거는 **PR + main push** (기존 `social-login.spec.ts` 패턴과 동일) — `TOSS_CLIENT_KEY_TEST` 환경변수 미설정 시 테스트 skip
- **D-13:** 테스트 키는 **별도 관리** — GitHub Actions secrets(`TOSS_CLIENT_KEY_TEST` / `TOSS_SECRET_KEY_TEST`) + 로컬 `.env`에 분리. 프로덕션 키와 완전 격리
- **D-14:** Toss SDK는 실제 로딩하되 `page.route()`로 Toss confirm API 응답을 제어하는 하이브리드는 허용 — 결정권은 planner/executor에게 (Claude's Discretion)

### useShowtimes 정리 (DEBT-06)
- **D-15:** `useShowtimes` 훅과 호출부 **전체 삭제** — 미존재 엔드포인트이고 `booking-page.tsx:70-72`에서 `performance?.showtimes`로 이미 fallback 처리됨. 삭제해도 UX 영향 없음
- **D-16:** 삭제 범위: `apps/web/hooks/use-booking.ts:26-35` 훅 정의 + `apps/web/components/booking/booking-page.tsx`의 import/useShowtimes 호출/`showtimesData ?? performance?.showtimes` 삼항 → `performance?.showtimes ?? []`로 단순화

### 좌석맵 테스트 회귀 (DEBT-03)
- **D-17:** 기대 동작: **다른 회원이 잠금 중인 좌석(locked) 클릭 시 `onSeatClick`은 호출되고, 부모 컴포넌트가 toast 안내** — 현재 테스트(`seat-map-viewer.test.tsx:135-159`) 의도와 일치
- **D-18:** 기대 동작 vs sold 좌석 대비: sold 좌석은 클릭 차단(`onSeatClick` 미호출, `seat-map-viewer.test.tsx:161-185`), locked 좌석은 클릭 허용 + parent toast — 두 상태의 UX 차이 유지
- **D-19:** **현재 테스트가 실제로 실패 중인지 여부는 planner 단계에서 확인** — `pnpm --filter @grapit/web test`로 확인 후 (a) 테스트가 실패하면 production 코드(seat-map-viewer.tsx) 수정, (b) 통과하면 booking-page에서 parent toast가 실제로 렌더되는지 수동 검증 및 필요 시 추가 테스트

### formatDateTime 타입 경고 (DEBT-04)
- **D-20:** `formatDateTime` 시그니처를 `(dateString: string | null | undefined): string` 으로 변경하고 null/undefined 시 '—' 반환 — 호출부 삼항 제거 가능. Claude's Discretion으로 세부 구현 허용

### 실행 전략 (Plan 분할 및 순서)
- **D-21:** **3 plans 구조**로 분할:
  - **Plan 1 (빠른 정리):** DEBT-03 + DEBT-04 + DEBT-06 — 테스트/타입/dead code 정리 (위험도 낮음, 독립적)
  - **Plan 2 (약관 + 이메일):** DEBT-02 + DEBT-01 — 인프라 도입 동반. Resend 패키지 + React Email + 약관 MD + EmailService 구현
  - **Plan 3 (Toss E2E):** DEBT-05 — Playwright 결제 spec + CI secrets 추가
- **D-22:** 실행 순서: **Plan 1 → Plan 2 → Plan 3** (빠른 정리로 초록 CI 확보 후 외부 연동, 마지막으로 E2E 세팅)

### Claude's Discretion
- Resend 환경변수 네이밍(`RESEND_API_KEY`, `RESEND_FROM_EMAIL`) 세부
- React Email 템플릿 파일 위치 및 스타일(`apps/api/src/modules/auth/emails/` 또는 모듈별 배치)
- `EmailService` 프로바이더 구조 (ConfigService 기반 조건부 실제/mock 분기 로직)
- 약관 MD 파일의 실제 문안 세부 (KOPICO 표준 기반 Grapit 각색)
- Toss E2E 테스트에서 실 SDK 로딩 vs `page.route()` 인터셉션 비율
- DEBT-03 테스트 회귀 원인 진단 후 구체적 fix 방법 (production 코드 vs 테스트 수정)
- `formatDateTime` 시그니처 변경 후 호출부 리팩터링 범위

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DEBT-01: Password Reset 이메일
- `apps/api/src/modules/auth/auth.service.ts:217-241` — `requestPasswordReset` 메서드 + console.log stub (L240)
- `apps/api/src/modules/auth/auth.controller.ts:119-136` — `POST /auth/password-reset/request` 및 `/confirm` 엔드포인트
- `apps/api/.env` (.env.example도 동일) — 환경변수 기존 패턴 확인 (SMS, JWT 등)
- `apps/api/src/modules/auth/auth.module.ts` — AuthService 의존성 주입 지점

### DEBT-02: 이용약관 Dialog
- `apps/web/components/auth/signup-step2.tsx:22-38` — TERMS_CONTENT 인라인 placeholder
- `apps/web/components/auth/signup-step2.tsx:183-195` — Dialog 컴포넌트 렌더링 구조

### DEBT-03: 좌석맵 테스트 회귀
- `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx:135-159` — locked 좌석 클릭 테스트 (기대: onSeatClick 호출됨)
- `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx:161-185` — sold 좌석 클릭 테스트 (기대: onSeatClick 미호출)
- `apps/web/components/booking/seat-map-viewer.tsx` — production 컴포넌트
- `apps/web/components/booking/booking-page.tsx` — parent 컴포넌트, toast 로직 확인 지점

### DEBT-04: formatDateTime 타입 경고
- `apps/web/components/admin/admin-booking-detail-modal.tsx:41-49` — `formatDateTime(dateString: string)` 시그니처
- `apps/web/components/admin/admin-booking-detail-modal.tsx:150` — `paidAt` 호출부 삼항
- `packages/shared/src/types/booking.types.ts:66` — `PaymentInfo.paidAt: string | null` 정의
- `apps/web/hooks/use-reservations.ts:79` — `useAdminBookingDetail` 반환 타입

### DEBT-05: Toss Payments E2E
- `apps/web/playwright.config.ts` — Playwright 설정 (baseURL 3000, webServer auto)
- `apps/web/e2e/social-login.spec.ts` — 기존 E2E 패턴 참조
- `apps/web/components/booking/toss-payment-widget.tsx` — Toss 위젯 렌더링
- `apps/api/src/modules/payment/toss-payments.client.ts:28-96` — confirmPayment/cancelPayment 메서드
- `apps/api/src/modules/payment/payment.service.spec.ts` — 기존 유닛 테스트 (mock)
- `.github/workflows/*.yml` — CI 파이프라인 (secrets 주입 패턴 확인)

### DEBT-06: useShowtimes Dead Code
- `apps/web/hooks/use-booking.ts:26-35` — useShowtimes 훅 정의 (enabled:false)
- `apps/web/components/booking/booking-page.tsx:10,44,70-72` — 사용 지점, fallback 구조
- `apps/api/src/modules/performance/performance.controller.ts` — 현재 엔드포인트 목록 (showtimes 라우트 없음 확인)

### 참조 문서
- `CLAUDE.md` — 프로젝트 conventions (pnpm 필터 + DOTENV_CONFIG_PATH, ESM, Drizzle, NestJS 11)
- `docs/tosspyments.md` — Toss Payments 연동 참고
- `.planning/REQUIREMENTS.md` — DEBT-01~06 원본 요구사항

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **SmsService 패턴:** 기존 `smsService`가 env 기반 dev mock 전환 패턴을 이미 확립. EmailService도 동일 패턴 복제
- **ConfigService 주입:** NestJS `@nestjs/config` 기반, `configService.get<string>('RESEND_API_KEY', '')` 형태로 사용 일관성 유지
- **Playwright E2E 인프라:** `playwright.config.ts`, `e2e/social-login.spec.ts` 구조를 참조하면 Toss E2E 파일 추가 비용 최소
- **React Query 기반 데이터 페칭:** useShowtimes 삭제 시 다른 훅 동작 영향 없음 (독립적)
- **Dialog 컴포넌트:** `signup-step2.tsx`에 이미 `@radix-ui/react-dialog` 기반 Dialog 래퍼 존재 — MD 내용만 교체하면 됨

### Established Patterns
- **env 기반 dev/prod 모드 전환:** `SmsService`, `UploadService`(Phase 8), `RedisProvider`(Phase 7) 모두 동일 패턴. EmailService도 이 패턴 필수
- **Atomic commit per plan:** 각 plan은 `feat(09-tech-debt-XX): ...` 또는 `fix(09-tech-debt-XX): ...` 형태로 독립 커밋
- **Testcontainers for integration:** Phase 7 도입된 testcontainers 인프라 재사용 가능 (이메일 E2E는 필요 없음)
- **Env가 없으면 silent degrade 금지:** Phase 7의 `production REDIS_URL hard-fail` 원칙을 email에도 적용 — NODE_ENV=production인데 `RESEND_API_KEY` 없으면 throw

### Integration Points
- **Plan 1 (빠른 정리):** 외부 의존성 0. `pnpm test`, `pnpm typecheck`, `pnpm lint`만 변경 검증
- **Plan 2 (이메일+약관):** Resend 계정 생성 + API 키 발급 + 도메인 인증(선택) — 1인 개발자가 Resend 대시보드에서 직접 수행
- **Plan 3 (Toss E2E):** Toss 개발자센터에서 테스트 키 발급 + GitHub Actions secrets 등록 — 수동 설정 작업 수반

</code_context>

<specifics>
## Specific Ideas

- **1인 개발 원칙 재확인:** 외부 서비스 추가 시 (Resend, Toss sandbox) dev 환경은 mock 우선으로 유지하여 로컬 테스트 편의성 보장
- **Resend React Email 통합:** Resend SDK + `@react-email/components` 패키지 조합이 Resend 공식 가이드. 템플릿 변경 시 `npx react-email preview`로 미리보기 가능
- **약관 MD import 방식:** Next.js 16에서 `import terms from '@/content/legal/terms-of-service.md?raw'` 또는 `next.config.ts`에 MDX 로더 추가. 단순 `?raw` 이면 MDX 불필요
- **Toss 공식 테스트 카드:** 문서 권장 카드 `4242-4242-4242-4242` 또는 Toss 개발자센터에서 발급받는 sandbox 전용 카드 번호 사용
- **DEBT-03 우선 확인:** planner는 `pnpm --filter @grapit/web test seat-map-viewer` 실행 결과를 먼저 확인하여 현재 실패 여부 파악 후 fix 방향 결정
- **formatDateTime 리팩터링:** 유틸을 nullable 수용형으로 바꾸면 `admin-booking-detail-modal` 외 다른 호출부에서도 불필요한 삼항 제거 가능 — 범위 확장은 Claude's Discretion

</specifics>

<deferred>
## Deferred Ideas

- **예매 확인 메일:** Phase 9 범위 외. 별도 phase에서 회원가입 완료/예매 완료/취소 확인 메일 일괄 구현 필요
- **사용자별 약관 동의 시점 버전 추적:** 법적 요구 발생 시 별도 phase. `terms_versions` + `user_consents` 테이블 설계 필요
- **약관 실제 문안의 법률 자문 반영:** 런칭 전 전문가 검토. Phase 9는 "구조 + 표준 템플릿 기반 초안"까지만
- **/performances/:id/showtimes 전용 엔드포인트:** 공연별 회차만 필요할 때 최적화용. 현재 performance detail API로 충분
- **Sold 좌석에도 toast 안내:** 현재 sold 좌석은 완전 차단. UX 개선 원하면 Phase 12 UX 현대화 범위에 포함
- **Toss E2E에서 모든 결제수단 커버:** 현재는 카드 결제만. 카카오페이/네이버페이/계좌이체 E2E는 별도 작업

</deferred>

---

*Phase: 09-tech-debt*
*Context gathered: 2026-04-14*
