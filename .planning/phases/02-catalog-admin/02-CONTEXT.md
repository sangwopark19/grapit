# Phase 2: Catalog + Admin - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

사용자가 장르별로 공연을 탐색·검색하고, 관리자가 공연 콘텐츠(공연 CRUD, 회차, SVG 좌석맵, 배너)를 관리하는 시스템. 홈 페이지를 카탈로그 중심으로 교체하고, GNB 장르 탭과 검색을 활성화한다.

</domain>

<decisions>
## Implementation Decisions

### 홈/카탈로그 구성
- **D-01:** 홈 페이지는 NOL 티켓 참조 구조: 메인 배너 캐러셀(Swiper) + HOT 공연 섹션(카드 4개 가로스크롤) + 신규 오픈 섹션(카드 4개) + 장르별 바로가기(아이콘 그리드)
- **D-02:** GNB 장르 탭은 주요 5개(뮤지컬, 콘서트, 연극, 전시, 클래식) 유지 + "더보기" 드롭다운으로 나머지 3개(스포츠, 아동/가족, 레저/캠핑) 표시
- **D-03:** 메인 배너 캐러셀은 Admin에서 배너 이미지+링크를 등록/관리하는 방식. ADMN 요구사항에는 없지만 홈 구성에 필요하므로 스코프에 포함
- **D-04:** 장르 카테고리 페이지(/genre/:genre)에서 서브카테고리 필터는 상단 칩 형태([전체][요즘HOT][오리지널/내한] 등). URL searchParams로 상태 관리

### 공연 카드 & 목록
- **D-05:** 공연 카드: 포스터(2:3 비율) + 상태 배지(판매중/마감임박/판매종료) + 공연명 + 장소 + 기간. 가격은 카드에 미표시 (상세에서 확인)
- **D-06:** 목록 그리드: 데스크톱 4열, 태블릿 3열, 모바일 2열 반응형
- **D-07:** 전통적 페이지네이션(1 2 3 ... 번호 페이지). URL searchParams로 페이지 상태 유지. SEO 친화적
- **D-08:** 정렬 옵션: 최신순(기본) + 인기순 토글

### 공연 상세 페이지
- **D-09:** 상단 레이아웃: 왼쪽 큰 포스터 + 오른쪽 공연 정보(제목, 장소, 기간, 관람연령, 공연시간, 등급별 가격표, 예매 CTA). 모바일에서는 세로 스택
- **D-10:** 예매 CTA: 오른쪽 정보 영역에 고정 + 스크롤 시 sticky. 모바일에서는 하단 고정 바. Phase 2에서는 disabled 상태 + "추후 오픈" 표시
- **D-11:** 캐스팅 정보: 배우 사진(circle avatar) + 이름 + 역할 그리드. Admin에서 배우 등록 시 사진 업로드
- **D-12:** 상세 페이지 탭 3개: 캐스팅(배우 목록) / 상세정보(공연 소개 이미지/텍스트) / 판매정보(취소·환불 규정, 주의사항)

### Admin 패널
- **D-13:** users 테이블에 role enum(USER/ADMIN) 컬럼 추가. NestJS Guard로 /admin API 보호. Next.js proxy에서 /admin 라우트 체크. 초기에는 DB에서 수동으로 ADMIN 설정
- **D-14:** 공연 등록/수정: 단일 페이지 섹션 폼(기본정보 / 미디어(포스터) / 가격 등급 / 회차 관리 / 캐스팅 / 좌석맵). 스크롤하며 작성
- **D-15:** SVG 좌석맵: 파일 업로드 → 미리보기 표시 → 등급별 좌석 그룹 선택하여 색상/가격 할당. SVG 내부 data-seat-id 속성으로 좌석 식별
- **D-16:** Admin 공연 목록: 테이블(포스터 썸네일, 공연명, 장르, 기간, 상태) + 상단 상태 필터 + 검색. 행 클릭 시 수정 페이지 이동
- **D-17:** Admin 배너 관리: 배너 이미지 업로드 + 링크 URL + 노출 순서 관리. 홈 캐러셀에 표시

### Claude's Discretion
- Admin 레이아웃 구조 (사이드바 네비게이션 vs 상단 탭)
- 검색 결과 페이지 레이아웃 (카드 그리드 재사용 vs 별도 디자인)
- 검색 자동완성/추천어 여부 (SRCH-01은 키워드 검색만 요구)
- 판매종료 포함/제외 토글 UI (SRCH-03)
- 공연 상태 관리 로직 (판매중/판매예정/판매종료 자동 전환 기준)
- 포스터 이미지 최적화 전략 (R2 업로드 + CDN 캐시)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 사이트 구조 & UX
- `docs/01-SITE-ANALYSIS-REPORT.md` — NOL 티켓 사이트맵, URL 패턴(/contents/genre/:genre, /goods/:goodsId), GNB 구조, 장르 카테고리 8개 목록
- `docs/04-UIUX-GUIDE.md` — 디자인 토큰, 컴포넌트 패턴, 레이아웃 구조. Primary/Secondary 컬러는 Phase 1 D-14~D-16의 Grapit 고유 컬러 사용
- `docs/04-UIUX-GUIDE.md` §2.2 — 타이포그래피 스케일, 폰트 스택 (Pretendard로 교체됨 — D-17 from Phase 1)

### 기능 요구사항
- `docs/02-PRD.md` §2.1 F-002 — 공연 카탈로그 요구사항: 장르별 카테고리, 서브카테고리 필터, 상세 정보 필드 목록
- `docs/02-PRD.md` §2.1 F-003 — 통합 검색 요구사항: 키워드 검색, 장르 필터, 판매종료 토글
- `.planning/REQUIREMENTS.md` — PERF-01~05, SRCH-01~03, ADMN-01~03 상세 수용 조건

### Admin 참조
- `docs/05-ADMIN-PREDICTION.md` — NOL 티켓 관리자 기능 역추론. §2 공연/이벤트 관리 화면 구성, 필요 API 엔드포인트

### 아키텍처
- `docs/03-ARCHITECTURE.md` — API 설계, DB 스키마, 모듈 구조. 공연/좌석 테이블 스키마 참조
- `CLAUDE.md` §Technology Stack — Drizzle ORM, zod, React Query, Zustand, Swiper, react-hook-form 버전 및 사용 패턴

### Phase 1 컨텍스트
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — 브랜드 컬러(D-14~D-17), GNB 구조(D-10), 홈 placeholder(D-11), 상태관리 패턴

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/components/layout/gnb.tsx` — GNB 컴포넌트. GENRE_TABS 배열(5개)이 이미 정의됨. disabled 상태 → 활성화 + 더보기 드롭다운 추가 필요
- `apps/web/components/layout/mobile-menu.tsx` — 모바일 메뉴. 장르 탭 추가 필요
- `apps/web/components/layout/footer.tsx` — 푸터 컴포넌트 (재사용)
- `apps/web/components/ui/` — shadcn 컴포넌트: button, checkbox, dialog, input, label, separator, sonner, tabs, form. Card 컴포넌트 없음 — 추가 필요
- `apps/web/lib/api-client.ts` — API 클라이언트 (인터셉터, 401 리프레시 포함). 재사용
- `apps/web/stores/use-auth-store.ts` — Zustand 인증 스토어. 패턴 참조하여 카탈로그 관련 스토어 생성
- `apps/web/lib/cn.ts` — cn() 유틸리티 (clsx + tailwind-merge)

### Established Patterns
- 상태관리: React Query (서버 상태) + Zustand (클라이언트 상태) + URL searchParams (필터/페이지)
- 유효성 검증: zod (프론트/백 공유)
- UI: shadcn/ui New York style + Tailwind v4 @theme 디자인 토큰
- API: NestJS 모듈 패턴 (auth, sms, user 모듈 참조)
- DB: Drizzle ORM schema (apps/api/src/database/schema/)

### Integration Points
- GNB 장르 탭 disabled → 활성화하여 /genre/:genre 라우트로 연결
- GNB 검색바 disabled → 활성화하여 /search 라우트로 연결
- 홈 placeholder → 카탈로그 홈으로 교체
- DB schema: users, social-accounts, refresh-tokens, terms-agreements 존재 → performances, showtimes, venues, seat-maps, banners, castings 테이블 추가 필요
- API: auth, sms, user 모듈 존재 → performance, search, admin 모듈 추가 필요

</code_context>

<specifics>
## Specific Ideas

- NOL 티켓(nol.interpark.com/ticket)의 홈 구성을 참조하되 Grapit 브랜드 컬러(딥 퍼플 #6C3CE0) 적용
- 공연 카드는 NOL 티켓의 카드형 목록 참조 (포스터 중심 + 핵심 정보)
- 상세 페이지는 NOL 티켓의 /goods/:goodsId 레이아웃 참조 (포스터+사이드 정보 + 하단 탭)
- Admin 배너 관리는 ADMN 요구사항에 없지만 홈 캐러셀에 필요하므로 최소 구현 (이미지+링크+순서)
- SVG 좌석맵은 data-seat-id 속성 기반으로 좌석 식별 — Figma에서 SVG 제작 시 이 속성을 포함하도록 가이드 필요

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-catalog-admin*
*Context gathered: 2026-03-30*
