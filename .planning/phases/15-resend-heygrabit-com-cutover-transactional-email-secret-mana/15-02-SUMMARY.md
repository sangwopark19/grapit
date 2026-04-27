---
phase: 15
plan: 02
status: complete
completed: 2026-04-27
requirements: [CUTOVER-01]
---

# Plan 15-02 Summary — Resend heygrabit.com 도메인 등록 + 후이즈 DNS

## What was built

운영자 sangwopark19icons@gmail.com 가 Resend 대시보드에 `heygrabit.com` 을 추가 (region=Tokyo `ap-northeast-1`) 하고, Resend 가 발급한 3 개 required DNS record (DKIM TXT 1 + SPF MX 1 + SPF TXT 1) 와 프로젝트 정의 DMARC TXT 1 row 를 후이즈 (whoisdomain.kr) 의 "MX 레코드 관리" / "SPF(TXT) 레코드 관리" 메뉴에 등록. dig 4 row 전부 literal match 확인. Resend 대시보드가 `Verified` 상태로 전환됨.

기존 `grapit.com` Resend 도메인은 건드리지 않음 (D-02 — Plan 03 의 안정 관측 window 종료 후 제거).

## Resend 발급 record (3 row, ap-northeast-1)

| # | Type | Name | Content | Priority |
|---|------|------|---------|----------|
| 1 | TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDIJN1oyMnw4Drxn9/wz2tyeuViq7hrU8NeqEydKBk8HgWp8g5diaMD0fHB57EVktS2Y0mB07HeIAUNShT2tILAcdFx9Tjf0o8K1HdFRKeroq1wAZ8aEIr+LkqFQVw+zBF7IibNEpTxACCesuSqwgnlFyHWQ5U5l+X8sfaiIgIZYwIDAQAB` | — |
| 2 | MX | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` | 10 |
| 3 | TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |

**Project-defined DMARC (Resend optional value 무시, D-04 lock):**
- TXT `_dmarc` → `v=DMARC1; p=none; rua=mailto:sangwopark19icons@gmail.com`

## dig literal match (4/4 ✅)

- `dig +short TXT resend._domainkey.heygrabit.com | tr -d '" '` → DKIM 발급값과 일치 ✅
- `dig +short MX send.heygrabit.com` → `10 feedback-smtp.ap-northeast-1.amazonses.com.` (trailing dot 제거 후 일치) ✅
- `dig +short TXT send.heygrabit.com | tr -d '" '` → `v=spf1 include:amazonses.com ~all` 일치 ✅
- `dig +short TXT _dmarc.heygrabit.com | tr -d '" '` → DMARC 프로젝트 정의값 일치 ✅

## Resend Domain Events 타임라인

- Domain added: 2026-04-27 09:40 KST
- DNS verified: 2026-04-27 11:40 KST (후이즈 등록 + propagation 완료 후)
- Domain verified: 2026-04-27 11:41 KST

총 소요 시간: ~2시간 (도메인 추가부터 Verified 까지)

## key-files.created

- .planning/phases/15-resend-heygrabit-com-cutover-transactional-email-secret-mana/15-HUMAN-UAT.md (Task 0)

## key-files.modified

- .planning/phases/15-resend-heygrabit-com-cutover-transactional-email-secret-mana/15-HUMAN-UAT.md (Tasks 1-3 → Wave 2 섹션 fill-in)

## Plan 03 진입 가능 여부

**PASS — D-08 sequence invariant 충족.**

Resend `heygrabit.com` 이 `Verified` 상태이므로 Plan 03 의 Secret Manager rotation 진행 가능.

## Self-Check: PASSED

- ✅ Resend Verified
- ✅ 후이즈 DNS 등록 (4 row: DKIM/SPF MX/SPF TXT/DMARC)
- ✅ dig row-by-row literal match (TXT chunked-string concat, MX trailing dot 제거 적용)
- ✅ 15-HUMAN-UAT.md Wave 2 섹션 전부 fill-in, Wave 3 placeholder 유지 (Plan 03 fill-in 대기)
- ✅ 구 grapit.com Resend 도메인은 건드리지 않음 (D-02)

## Next

Plan 03 Task 0 pre-gate (Plan 01 코드의 Cloud Run 배포 확인) 부터 실행 가능. 단, Plan 03 는 production cutover (Secret rotation + Cloud Run 재배포 + 3사 UAT + 48h 관측) 라 multi-session 진행 권장.
