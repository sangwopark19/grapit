---
quick_id: 260406-nee
description: "토스 페이먼츠 테스트키가 예약 페이지 결제 수단에 표시되지 않는 문제 수정"
date: 2026-04-06
status: completed
---

# Quick Task Summary: 토스 페이먼츠 환경변수 로딩 수정

## Problem

예매 확인 페이지(`/booking/[id]/confirm`)에서 토스 페이먼츠 결제 위젯이 렌더링되지 않고 "결제 설정이 완료되지 않았습니다. 관리자에게 문의해주세요." 에러 메시지가 표시됨.

## Root Cause

- `.env` 파일이 모노레포 루트(`/grapit/.env`)에만 존재
- Next.js는 자체 프로젝트 디렉토리(`apps/web/`) 기준으로 `.env`를 로드
- `toss-payment-widget.tsx:66`에서 `process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY`가 `undefined`
- SDK 초기화 실패 → 에러 상태 렌더링

## Fix Applied

`apps/web/next.config.ts`에 모노레포 루트 `.env` 로딩 코드 추가:
- Node.js `fs.readFileSync`로 `../../.env` 파일 파싱
- 기존 `process.env`에 없는 키만 주입 (기존 환경변수 우선)
- `.env` 파일이 없어도 에러 없음 (CI/프로덕션 환경 호환)

## Verification

dev-browser로 전체 예매 플로우를 수행하여 확인:
1. 홈 → 공연 상세 → 예매 → 날짜 선택 → 회차 선택 → 좌석 선택 → 결제 확인 페이지
2. 결제 수단 섹션에 토스 결제 위젯 정상 렌더링 확인
3. 퀵계좌이체, 신용/체크카드, toss pay, PAYCO, 카카오 pay, 네이버 pay 모두 표시

## Files Changed

- `apps/web/next.config.ts` — 루트 .env 로딩 코드 추가
