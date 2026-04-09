# Milestones

## v1.0 MVP (Shipped: 2026-04-09)

**Delivered:** 공연 탐색부터 좌석 선택, 결제, 예매 관리까지 전체 티켓 예매 플로우를 갖춘 MVP

**Phases:** 5 | **Plans:** 23 | **Tasks:** 45
**Timeline:** 13일 (2026-03-27 ~ 2026-04-09) | **Commits:** 331 | **LOC:** 23,547 TypeScript
**Git range:** `26ed1b4..9d96536`

**Key accomplishments:**

1. **인증 시스템** — 이메일/비밀번호 + 카카오/네이버/구글 소셜 OAuth, JWT + Refresh Token Rotation, family-based 탈취 감지
2. **공연 카탈로그** — 8개 장르 카테고리, tsvector+ILIKE 검색, 관리자 CRUD + R2 포스터 업로드
3. **SVG 좌석맵** — react-zoom-pan-pinch 기반 인터랙티브 좌석 선택, Redis SET NX 10분 잠금, Socket.IO 실시간 동기화
4. **결제 연동** — Toss Payments SDK v2 (카드/카카오페이/네이버페이/계좌이체), 서버사이드 금액 검증, 취소/환불
5. **프로덕션 준비** — 모바일 반응형 + 스켈레톤 UI + 한국어 에러 핸들링 + Sentry + Docker + CI/CD + Cloud Run

### Known Tech Debt (12 items)

- Password reset email: console.log stub (nodemailer 미설정)
- Terms dialog: placeholder 텍스트 (법률 검토 필요)
- seat-map-viewer.test.tsx: locked seat click 테스트 1건 회귀
- admin-booking-detail-modal.tsx: formatDateTime null 타입 경고
- Phase 4 VERIFICATION.md stale (SDK 설치 후 미갱신)
- Toss Payments E2E 테스트: human verification 필요

### Known Integration Issue

- `useShowtimes` hook의 `/api/v1/performances/:id/showtimes` 라우트 미존재 (enabled:false, 런타임 영향 없음)

---
