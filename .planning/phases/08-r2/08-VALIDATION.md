---
phase: 8
slug: r2
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @grapit/api test -- upload.service` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grapit/api test -- upload.service`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green + browser R2 upload/display manual check
- **Max feedback latency:** 15s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | R2-01 | T-08-01 | S3Client forcePathStyle:true R2 endpoint | unit | `pnpm --filter @grapit/api test -- upload.service` | ✅ | ⬜ pending |
| 08-01-02 | 01 | 1 | R2-03 | T-08-02 | presigned URL 600초 만료, HTTPS 전용 | unit | `pnpm --filter @grapit/api test -- upload.service` | ✅ | ⬜ pending |
| 08-01-03 | 01 | 1 | R2-04 | — | publicUrl R2_PUBLIC_URL 기반 생성 | unit | `pnpm --filter @grapit/api test -- upload.service` | ✅ | ⬜ pending |
| 08-02-01 | 02 | 1 | R2-03 | — | next.config.ts remotePatterns 환경변수 동적 설정 | typecheck | `pnpm --filter @grapit/web typecheck` | ✅ | ⬜ pending |
| 08-03-01 | 03 | 2 | R2-02 | — | CORS AllowedHeaders 명시적 지정 | manual-only | Cloudflare dashboard/API 확인 | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `upload.service.spec.ts` — `forcePathStyle: true` 검증 테스트 추가 (R2-01)

*Existing infrastructure covers most phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| R2 CORS AllowedHeaders에 content-type 포함 | R2-02 | Cloudflare 인프라 설정 — 코드로 검증 불가 | Cloudflare dashboard에서 CORS 규칙 확인 또는 브라우저에서 PUT 업로드 테스트 |
| R2 버킷 공개 접근 URL 동작 | R2-03 | 실제 R2 인프라 필요 | 업로드된 파일 공개 URL로 브라우저 접근 확인 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
