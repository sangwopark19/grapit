---
mode: quick
quick_id: 260406-nee
description: "토스 페이먼츠 테스트키가 예약 페이지 결제 수단에 표시되지 않는 문제 수정"
date: 2026-04-06
---

# Quick Task Plan: 토스 페이먼츠 환경변수 로딩 수정

## Root Cause

모노레포 루트의 `.env` 파일에 `NEXT_PUBLIC_TOSS_CLIENT_KEY`가 설정되어 있지만, Next.js는 자체 프로젝트 디렉토리(`apps/web/`) 기준으로 `.env`를 로드한다. 따라서 `process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY`가 `undefined`가 되어 결제 위젯이 "결제 설정이 완료되지 않았습니다" 에러를 표시.

## Fix

`apps/web/next.config.ts`에서 모노레포 루트 `.env`를 `fs.readFileSync`로 파싱하여 `process.env`에 로드. Next.js가 NEXT_PUBLIC_* 변수를 인라인할 수 있도록 config 평가 전에 환경변수를 설정.

## Tasks

### Task 1: next.config.ts에 루트 .env 로딩 추가

- **files**: `apps/web/next.config.ts`
- **action**: `readFileSync`로 `../../.env` 파일을 읽어 `process.env`에 주입하는 코드 추가
- **verify**: dev 서버 재시작 후 결제 확인 페이지에서 토스 결제 위젯이 렌더링되는지 확인
- **done**: 토스 결제 위젯에 카드/토스페이/네이버페이/카카오페이 등 결제 수단이 정상 표시됨
