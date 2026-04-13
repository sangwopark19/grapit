---
phase: quick
plan: 260413-jw1
subsystem: database/seed
tags: [admin, seed, argon2, auth]
dependency_graph:
  requires: [users-table, argon2]
  provides: [admin-user-seed]
  affects: [seed.mjs]
tech_stack:
  added: []
  patterns: [argon2id-hashing, fk-safe-seed-cleanup]
key_files:
  created: []
  modified:
    - apps/api/src/database/seed.mjs
decisions:
  - argon2id with CLAUDE.md settings (19MiB, 2 iterations, 1 parallelism)
  - FK-safe DELETE order for seed re-run idempotency
metrics:
  duration: 3m
  completed: 2026-04-13
  tasks: 2
  files: 1
---

# Quick Task 260413-jw1: Admin User Seed Summary

seed.mjs에 argon2id 해싱된 어드민 유저(admin@grapit.test)를 추가하여 /admin 접근용 계정을 시드에서 생성하도록 수정

## What Changed

### Task 1: seed.mjs에 어드민 유저 INSERT 추가
- **Commit:** 8ec6768
- argon2 import 추가
- 기존 DELETE 문 앞에 admin@grapit.test 전용 FK-safe DELETE (refresh_tokens, social_accounts, terms_agreements, users)
- argon2id 해싱으로 admin 유저 INSERT (email: admin@grapit.test, role: admin, password: TestAdmin2026!)
- argon2 설정: memoryCost 19456, timeCost 2, parallelism 1 (CLAUDE.md 기준)

### Task 2: seed 실행 및 DB 검증
- **Commit:** 7bd1753
- seed 실행 성공 확인 ("Inserted admin user: admin@grapit.test" 출력)
- DB 조회 결과: `{email: "admin@grapit.test", role: "admin", name: "관리자", has_password: true}`
- 재실행 시 중복 에러 없이 정상 동작 확인

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] seed 실행 시 FK 제약 위반 오류 수정**
- **Found during:** Task 2
- **Issue:** 기존 seed.mjs에 reservations 관련 테이블 DELETE가 누락되어, 예약 데이터가 있는 상태에서 showtimes DELETE 시 FK 위반 발생 (`reservations_showtime_id_showtimes_id_fk`)
- **Fix:** payments, reservation_seats, reservations, seat_inventories 테이블 DELETE를 기존 DELETE 문 앞에 추가
- **Files modified:** apps/api/src/database/seed.mjs
- **Commit:** 7bd1753

## Verification Results

| Check | Result |
|-------|--------|
| admin@grapit.test in seed.mjs | PASS |
| argon2 import present | PASS |
| role='admin' in INSERT | PASS |
| seed 실행 성공 | PASS |
| DB에 admin 유저 존재 | PASS |
| role이 'admin' | PASS |
| password_hash NOT NULL | PASS |
| 재실행 idempotency | PASS |
