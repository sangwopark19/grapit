# Requirements: Grapit

**Defined:** 2026-03-27
**Core Value:** 사용자가 원하는 공연을 발견하고, 좌석을 직접 선택하여, 안정적으로 예매를 완료할 수 있는 것

## v1 Requirements

Requirements for initial release (MVP). Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: 사용자가 이메일/비밀번호로 회원가입할 수 있다
- [x] **AUTH-02**: 사용자가 이메일/비밀번호로 로그인할 수 있다
- [x] **AUTH-03**: 사용자가 카카오 소셜 로그인으로 가입/로그인할 수 있다
- [x] **AUTH-04**: 사용자가 네이버 소셜 로그인으로 가입/로그인할 수 있다
- [x] **AUTH-05**: 사용자가 구글 소셜 로그인으로 가입/로그인할 수 있다
- [x] **AUTH-06**: 로그인 세션이 브라우저 새로고침 후에도 유지된다 (JWT + Refresh Token Rotation)
- [x] **AUTH-07**: 사용자가 로그아웃할 수 있다

### Performance Catalog

- [ ] **PERF-01**: 사용자가 장르별(뮤지컬, 콘서트, 연극 등 8개) 카테고리로 공연을 탐색할 수 있다
- [x] **PERF-02**: 사용자가 서브카테고리 필터(전체, 요즘HOT, 오리지널/내한 등)로 공연을 필터링할 수 있다
- [ ] **PERF-03**: 공연 상세 페이지에서 포스터, 공연명, 장소, 기간, 공연시간, 관람연령, 등급별 가격을 확인할 수 있다
- [ ] **PERF-04**: 공연 상세 페이지에서 캐스팅 정보를 확인할 수 있다
- [ ] **PERF-05**: 공연 목록이 카드형(포스터+정보)으로 페이지네이션되어 표시된다

### Search

- [x] **SRCH-01**: 사용자가 공연명 키워드로 검색할 수 있다
- [x] **SRCH-02**: 검색 결과를 장르별로 필터링할 수 있다
- [ ] **SRCH-03**: 판매종료 공연 포함/제외 토글이 제공된다

### Seat Map & Booking

- [x] **SEAT-01**: SVG 기반 좌석 배치도가 등급별 색상으로 구분되어 표시된다
- [x] **SEAT-02**: 좌석 배치도에서 확대/축소/전체보기 컨트롤이 제공된다
- [x] **SEAT-03**: 모바일에서 핀치 줌/드래그 이동이 지원된다
- [x] **SEAT-04**: 이미 판매/점유된 좌석이 비활성 표시되며 선택할 수 없다
- [x] **SEAT-05**: 선택한 좌석이 사이드 패널에 좌석 정보(등급, 가격)와 함께 표시된다
- [x] **SEAT-06**: 타 사용자의 좌석 선택/해제가 실시간으로 반영된다 (WebSocket/SSE)
- [x] **BOOK-01**: 캘린더에서 예매 가능한 날짜를 선택할 수 있다
- [x] **BOOK-02**: 선택한 날짜의 회차(시간)를 선택할 수 있다
- [x] **BOOK-03**: 좌석 선택 시 Redis SET NX로 10분간 임시 점유된다
- [x] **BOOK-04**: 임시 점유 TTL 만료 시 좌석이 자동으로 해제된다

### Payment

- [ ] **PAY-01**: 신용/체크카드로 결제할 수 있다 (Toss Payments)
- [ ] **PAY-02**: 카카오페이로 결제할 수 있다
- [ ] **PAY-03**: 네이버페이로 결제할 수 있다
- [ ] **PAY-04**: 계좌이체로 결제할 수 있다
- [ ] **PAY-05**: 최종 결제 금액이 좌석 등급/수량 기반으로 정확히 표시된다
- [ ] **PAY-06**: 결제 완료 시 예매번호가 발급되고 확인 페이지가 표시된다
- [ ] **PAY-07**: 결제 실패/취소 시 좌석 점유가 해제되고 안내 메시지가 표시된다

### Reservation Management

- [ ] **RESV-01**: 마이페이지에서 예매 내역 목록을 조회할 수 있다
- [ ] **RESV-02**: 예매 상세(예매번호, 좌석, 결제 정보, 취소마감시간)를 확인할 수 있다
- [ ] **RESV-03**: 취소마감시간 전 예매를 취소하고 환불받을 수 있다

### Admin

- [x] **ADMN-01**: 관리자가 공연을 등록/수정/삭제할 수 있다 (제목, 장르, 장소, 기간, 가격, 포스터 등)
- [x] **ADMN-02**: 관리자가 공연의 회차(날짜/시간)를 등록/수정/삭제할 수 있다
- [x] **ADMN-03**: 관리자가 공연장의 SVG 좌석 배치도를 업로드하고 좌석 등급/가격을 설정할 수 있다
- [ ] **ADMN-04**: 관리자가 예매 목록을 조회하고 환불 처리할 수 있다

### Infrastructure

- [ ] **INFR-01**: 모바일 반응형 디자인이 적용된다 (터치 타겟 44px, 바텀시트 등)
- [ ] **INFR-02**: 페이지 로딩 시 스켈레톤 UI가 표시된다
- [ ] **INFR-03**: API 에러 시 사용자 친화적 에러 메시지와 재시도 버튼이 표시된다

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Engagement

- **RANK-01**: 장르별/기간별 예매 랭킹을 조회할 수 있다
- **NOTC-01**: 오픈예정 공연 목록을 확인할 수 있다
- **CAST-01**: 티켓캐스트(오픈 알림)를 등록할 수 있다
- **PRMO-01**: 타임딜/파이널콜 등 프로모션 공연이 홈에 노출된다
- **CUPN-01**: 쿠폰/포인트를 적용할 수 있다

### Queue System

- **QUEU-01**: 트래픽 스파이크 시 대기열이 자동 활성화된다
- **QUEU-02**: 대기 순번이 실시간으로 표시된다

### Social

- **SOCL-01**: 관람후기를 작성/조회할 수 있다
- **SOCL-02**: 기대평을 작성/조회할 수 있다
- **SOCL-03**: 공연을 SNS에 공유할 수 있다

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 인라인 SVG 좌석맵 편집기 | 4-8주 공수. Figma/Illustrator에서 제작 후 업로드로 대체 |
| 마이크로서비스 아키텍처 | 1인 개발에서 분산 시스템 운영 불가. NestJS 모듈러 모놀리스로 충분 |
| Elasticsearch | <100k 공연 규모에서 PostgreSQL tsvector로 충분 |
| Kafka/RabbitMQ | pg-boss(SKIP LOCKED)로 충분한 처리량 |
| 실시간 채팅 | 티켓 예매 UX와 무관. 사용자는 구매하러 옴 |
| 모바일 앱 (Expo) | 웹 우선 검증. PMF 확인 후 Phase 4 |
| 다국어 지원 | 한국 시장 집중. Phase 3+ |
| 다크모드 | 경쟁사 미지원. CSS 변수로 추후 추가 가능 |
| 로터리 티켓(추첨제) | 높은 복잡도. Phase 3 |
| 본인인증(PASS) | 초기 서비스에서 불필요 |
| 동적 가격 책정 | 구현 복잡도 대비 초기 가치 낮음 |
| 멤버십/등급 시스템 | 충분한 사용자 데이터 축적 후 도입 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| AUTH-07 | Phase 1 | Complete |
| PERF-01 | Phase 2 | Pending |
| PERF-02 | Phase 2 | Complete |
| PERF-03 | Phase 2 | Pending |
| PERF-04 | Phase 2 | Pending |
| PERF-05 | Phase 2 | Pending |
| SRCH-01 | Phase 2 | Complete |
| SRCH-02 | Phase 2 | Complete |
| SRCH-03 | Phase 2 | Pending |
| ADMN-01 | Phase 2 | Complete |
| ADMN-02 | Phase 2 | Complete |
| ADMN-03 | Phase 2 | Complete |
| SEAT-01 | Phase 3 | Complete |
| SEAT-02 | Phase 3 | Complete |
| SEAT-03 | Phase 3 | Complete |
| SEAT-04 | Phase 3 | Complete |
| SEAT-05 | Phase 3 | Complete |
| SEAT-06 | Phase 3 | Complete |
| BOOK-01 | Phase 3 | Complete |
| BOOK-02 | Phase 3 | Complete |
| BOOK-03 | Phase 3 | Complete |
| BOOK-04 | Phase 3 | Complete |
| BOOK-05 | Phase 4 | Pending |
| PAY-01 | Phase 4 | Pending |
| PAY-02 | Phase 4 | Pending |
| PAY-03 | Phase 4 | Pending |
| PAY-04 | Phase 4 | Pending |
| PAY-05 | Phase 4 | Pending |
| PAY-06 | Phase 4 | Pending |
| PAY-07 | Phase 4 | Pending |
| RESV-01 | Phase 4 | Pending |
| RESV-02 | Phase 4 | Pending |
| RESV-03 | Phase 4 | Pending |
| ADMN-04 | Phase 4 | Pending |
| INFR-01 | Phase 5 | Pending |
| INFR-02 | Phase 5 | Pending |
| INFR-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0
