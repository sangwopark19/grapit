---
phase: quick
plan: 260407-lid-svg
subsystem: web/booking
tags: [svg, responsive, mobile, seat-map]
dependency_graph:
  requires: []
  provides: [responsive-svg-seat-map]
  affects: [booking-flow-mobile-ux]
tech_stack:
  added: []
  patterns: [viewBox-preservation, responsive-svg]
key_files:
  modified:
    - apps/web/components/booking/seat-map-viewer.tsx
decisions:
  - viewBox 없는 SVG에 대해 기존 width/height로 viewBox 자동 생성 후 고정 크기 제거
metrics:
  duration: 1min
  completed: 2026-04-07
  tasks: 1
  files: 1
---

# Quick Task 260407-lid: SVG 좌석맵 모바일 뷰포트 잘림 수정 Summary

모바일(328px)에서 SVG 고정 width="800"이 TransformComponent를 800px로 확장시켜 우측 좌석이 overflow:hidden으로 잘리던 문제를 viewBox 보존 + 고정 크기 제거 + 컨테이너 제약으로 수정

## Changes

### Task 1: SVG viewBox 보존 + 고정 크기 제거 + 컨테이너 제약

**Commit:** fd02a0e

세 가지 수정을 적용:

1. **processedSvg useMemo**: SVG 루트 엘리먼트에서 고정 `width`/`height` 속성을 제거하고, `viewBox`가 없으면 기존 크기값으로 자동 생성 후, `width:100%;height:auto;display:block` 반응형 스타일 적용
2. **TransformComponent**: `wrapperStyle={{ width: '100%', maxWidth: '100%' }}` + `contentStyle={{ width: '100%' }}` 추가하여 라이브러리 인라인 사이징 오버라이드
3. **외부 컨테이너 div**: `overflow-hidden` 클래스 추가하여 잔여 오버플로우 방지

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript 컴파일: PASS (exit 0, 에러 없음)
- 모바일 뷰포트 시각 확인: checkpoint:human-verify 대기 중

## Self-Check: PENDING

코드 커밋 완료. 시각적 검증(checkpoint:human-verify) 대기 중.
