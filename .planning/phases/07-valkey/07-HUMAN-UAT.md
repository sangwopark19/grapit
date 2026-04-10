---
status: partial
phase: 07-valkey
source: [07-VERIFICATION.md]
started: 2026-04-10T04:35:00Z
updated: 2026-04-10T04:35:00Z
---

## Current Test

[awaiting human testing — Cloud Run 배포 후 런타임 검증 필요]

## Tests

### 1. Cloud Run 배포 후 좌석 잠금(SET NX + TTL) 동작 확인
expected: lockSeat API 호출 시 Valkey(10.178.0.3:6379)에 `seat:{showtimeId}:{seatId}` 키로 SET NX 성공, TTL 600초(10분) 설정, 만료 후 자동 해제
result: [pending]
why_human: Valkey 인스턴스는 VPC PSC 전용 엔드포인트라 로컬/CI에서 접근 불가

### 2. CLUSTER 모드 Valkey ↔ ioredis standalone 연결 호환성
expected: Cloud Run API 기동 시 ioredis가 `redis://10.178.0.3:6379`에 standalone 클라이언트로 정상 연결, `[redis] Error:` 로그 없음
result: [pending]
why_human: Plan 03 SUMMARY의 알려진 오픈 이슈 — Memorystore for Valkey는 단일 샤드도 CLUSTER 모드로 생성. standalone 클라이언트 호환성은 실제 배포에서만 확인 가능. 실패 시 `new Redis.Cluster([{host:'10.178.0.3', port:6379}])` 업그레이드 필요

### 3. Cloud Run → Valkey VPC 연결 안정성
expected: 배포 완료 후 `GET /api/v1/health` 엔드포인트에서 Redis health OK, 30분 idle 후 재연결 시에도 에러 없음
result: [pending]
why_human: VPC Direct Egress 네트워킹은 실제 배포 환경에서만 검증 가능

### 4. Socket.IO Redis adapter 다중 인스턴스 pub/sub 전파
expected: Cloud Run 2개 인스턴스에서 인스턴스 A의 lockSeat → 인스턴스 B 클라이언트가 `seat-update` 이벤트 수신
result: [pending]
why_human: 다중 인스턴스 실시간 동기화는 런타임 검증 필요. 코드 레벨에서는 `RedisIoAdapter` 클래스 + main.ts `useWebSocketAdapter()` 연결 완료(commit 2747566)

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
