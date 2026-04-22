# Phase 12: UX 현대화 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 12-ux
**Areas discussed:** UX-01 디자인 현대화 범위+방향, UX-02 스테이지 방향 표준화, UX-04 좌석 선택 애니메이션, UX-05+06 미니맵+모바일 44px

---

## Gray Area 선택

| Option | Description | Selected |
|--------|-------------|----------|
| 디자인 현대화 범위+방향 (UX-01) | 작업 깊이·트렌드 방향·브랜드 컬러 유지·파일럿 페이지 | ✓ |
| 스테이지 방향 표준화 (UX-02) | SVG 규격 강제 vs 뷰어 오버레이 vs 메타 필드 | ✓ |
| 좌석 선택 애니메이션 (UX-04) | transition 재도입 전략/피드백 스타일/성능 리스크 | ✓ |
| 미니맵 + 모바일 44px (UX-05+06) | 미니맵 형태·위치·모바일 노출 / 44px 보장 전략 | ✓ |

**User's choice:** 4개 영역 전부

---

## UX-01 디자인 현대화 범위+방향

### Q1. 디자인 현대화 작업의 깊이는 어느 정도?

| Option | Description | Selected |
|--------|-------------|----------|
| 토큰 레벨 조정만 (Recommended) | globals.css @theme shadow/radius/spacing/motion만. JSX 무수정. 리스크 최소 | ✓ |
| 핵심 컴포넌트 재작업 | 토큰 + Card/Badge/Button variant 마크업 + 홈 Hero/GenreGrid 레이아웃 강화 | |
| 전면 개편 | 전 페이지 재디자인 (회귀 가능성, 일정 부담) | |

### Q2. '모던 트렌드'는 구체적으로 어떤 방향?

| Option | Description | Selected |
|--------|-------------|----------|
| 조여진 Minimalism (Recommended) | Linear/Vercel 계열 — 엄격한 whitespace, radius 8~12px, 연한 shadow, purple 액센트 집중 | ✓ |
| Bento Grid + Asymmetric Cards | Apple/Arc 계열, 레이아웃 재작업 필요 | |
| Soft UI / Neumorphism-lite | 접근성 컨트라스트 우려 | |
| Motion-forward | framer-motion 대폭 도입, 성능/배터리 비용 | |

### Q3. 브랜드 퍼플 #6C3CE0는?

| Option | Description | Selected |
|--------|-------------|----------|
| 그대로 유지 (Recommended) | Phase 11 chart palette 호환성 유지, 브랜드 인지 축적 중 | ✓ |
| 미세 조정만 | Gradient 보조 액센트 추가 | |
| 완전 교체 | 새 브랜드 컬러 (과잉) | |

### Q4. 파일럿 페이지?

| Option | Description | Selected |
|--------|-------------|----------|
| 홈(HotSection, NewSection, GenreGrid) | 첫인상·사용자 유입마다 노출 | ✓ |
| 상세 페이지(/performance/[id]) | 예매 직전 전환율 영역 | |
| 예매 종합 호흡 | Phase 12 UX-02~06과 중복 | |
| 토큰만 적용하면 파일럿 불필요 | | |

### Q5. 홈 파일럿에서 토큰 적용 외에 JSX도 손보나요?

| Option | Description | Selected |
|--------|-------------|----------|
| 토큰만 — 홈은 검증 스팟이면 충분 | JSX 수정 0줄 | |
| 토큰 + 홈 전용 미세 튜닝 (Recommended) | 3~5줄 수준 성형 허용, 신규 컴포넌트 추가 없음 | ✓ |
| 토큰 + 홈 레이아웃 재구성 | HotSection/NewSection/GenreGrid 배치 변경 | |

**Notes:** 토큰 중심·Minimalism·Purple 유지·홈 파일럿 경량 성형 허용으로 1인 개발 리스크 최소화.

---

## UX-02 스테이지 방향 표준화

### Q1. 스테이지 표시 소스는 어디에서?

| Option | Description | Selected |
|--------|-------------|----------|
| SVG 내부 검증 (Recommended) | admin 업로드 시 data-stage 또는 <text>STAGE</text> 필수 검증 | ✓ |
| DB 메타데이터 필드 | performances/seatMapConfig stagePosition 컬럼, 스키마 마이그레이션 필요 | |
| 뷰어 자동 감지 | 키워드·좌표 기반 추론, 오류 사례 위험 | |

### Q2. 뷰어에서의 시각적 표현?

| Option | Description | Selected |
|--------|-------------|----------|
| SVG 안의 기존 <text>STAGE> 활용 (Recommended) | 있으면 사용, 없으면 data-stage 위치에 viewer가 오버레이 | ✓ |
| 면밀한 각인드 공간 표시 | 좌석맵 외부 미니 바 | |
| 화살표 + 그라데이션 바드 | 시각적 강력, 구현 복잡 | |

### Q3. 기존 업로드된 SVG (sample-seat-map.svg 형식) 호환성?

| Option | Description | Selected |
|--------|-------------|----------|
| 변환 없이 호환 (Recommended) | <text>STAGE</text> fallback 파싱, 기존 데이터 migration 불필요 | ✓ |
| 기존 SVG 리-업로드 요구 | 일관성 수확, 운영 부담 | |
| DB 마이그레이션으로 일괄 설정 | Q1에서 DB 필드 선택 시만 적합 | |

**Notes:** SVG가 SoT, DB 스키마 변경 없음. admin 클라이언트 측 검증만 추가.

---

## UX-04 좌석 선택 애니메이션

### Q1. 애니메이션 테크닉은?

| Option | Description | Selected |
|--------|-------------|----------|
| 선택/해제 좌석에만 transition (Recommended) | 수백 좌석 동시 재렌더 리스크 차단, 성능 안전 | ✓ |
| CSS-only fill/opacity 전체 transition | 간단하지만 broadcast 스파이크 시 frame drop 위험 | |
| framer-motion 도입 | 양질 애니메이션, 수백 이펙트 리스너 부담 | |

### Q2. 피드백 스타일은?

| Option | Description | Selected |
|--------|-------------|----------|
| 체크마크 fade-in + fill 전환 (Recommended) | 기존 체크마크 삽입 로직 재활용, 150ms transition | ✓ |
| Scale 펄스 (0.95→1.05→1) | transform-origin 이슈 + 좌석 오버랩 위험 | |
| Glow/pulse ring | SVG 오버랩/interference 가능성 | |

### Q3. 실시간 브로드캐스트로 타인이 좌석 잠금/해제 시?

| Option | Description | Selected |
|--------|-------------|----------|
| 애니메이션 없이 즉시 상태 전환 (Recommended) | flick 방지, "뺏긴 건가?" 혼란 방지, 성능 안전 | ✓ |
| 모든 좌석 상태 변경에 얇은 fade (100ms) | 생동감 있지만 broadcast 스파이크 | |
| 정책 결정 유보 — Claude 재량 | 구현 단계 프로파일링 의존 | |

**Notes:** 로컬 명시적 선택/해제만 애니메이션 대상. broadcast는 즉시 전환.

---

## UX-05+06 미니맵 + 모바일 44px 터치 타겟

### Q1. 미니맵 구현 형태?

| Option | Description | Selected |
|--------|-------------|----------|
| 축소 SVG 복제 + viewport rect (Recommended) | processedSvg 재활용, seat state 실시간 반영 | ✓ |
| 단순 좌석맵 썸네일 이미지 | 실시간 전파 불가 | |
| Aspect ratio 라벨만 | 최소 구현, 명확도 낮음 | |

### Q2. 미니맵 위치 및 모바일 노출?

| Option | Description | Selected |
|--------|-------------|----------|
| 데스크톱 좌상단 고정 + 모바일 숨김 (Recommended) | 우측은 zoom 컨트롤과 충돌, 모바일 폭 부족 | ✓ |
| 항상 호출 (일단 품격폼처럼) | 모바일 UX 얅음 | |
| 줌될 > 1.5x일 때만 자동 표시 | 스마트함, 구현/테스트 복잡도 증가 | |

### Q3. 44px 터치 타겟 보장 전략 (UX-06)?

| Option | Description | Selected |
|--------|-------------|----------|
| 모바일 자동 초기 줌 1.4x (Recommended) | breakpoint < md 시 initialScale=1.4, 32→44.8px | ✓ |
| Hit-area invisible overlay (pointer-events) | SVG 복잡도 증가, tooltip 간섭 | |
| 업로드 시 admin 검증 | 기존 SVG migration 부담 | |
| 모바일 자동 줌 + admin 경고 혼합 | 과잉 | |

**Notes:** SVG/DB 변경 없는 뷰어 레벨 솔루션. 사용자의 수동 zoom-out(minScale=0.5)은 계속 허용.

---

## Claude's Discretion

- `@theme` shadow/radius/spacing 구체 숫자값
- 스테이지 오버레이 배지 정확한 마크업/폰트/색상
- 체크마크 fade-in 구현 방식 (CSS transition vs SMIL)
- 미니맵 viewport rect 색상
- 홈 파일럿 미세 튜닝 3~5줄 범위
- 모바일 breakpoint 감지 방식 (media query vs useMediaQuery 훅)

## Deferred Ideas

- 상세/예매/마이페이지 개별 페이지 재디자인 → v1.2
- Motion-forward 대규모 도입 → v2
- Bento Grid/Asymmetric 레이아웃 → 정체성 확립 후
- 다크모드 → Out of Scope
- Scale 펄스 / Glow ring 애니메이션 → Phase 12 out
- 미니맵 모바일 토글 버튼 → 공연장 규모 확대 시 재검토
- Hit-area overlay rect → 모바일 자동 줌으로 해결
- SVG 업로드 서버 측 검증 → 보안 phase 분리
- stagePosition DB 컬럼 → SVG SoT 유지
- 햅틱 UX-07 → v2
- 캐러셀 재설계, 접근성 전면 오딧 → 별도 phase
