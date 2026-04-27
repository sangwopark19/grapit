---
phase: 15-resend-heygrabit-com-cutover-transactional-email-secret-mana
fixed_at: 2026-04-27T06:43:13Z
review_path: .planning/phases/15-resend-heygrabit-com-cutover-transactional-email-secret-mana/15-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 0
skipped: 1
status: none_fixed
---

# Phase 15: Code Review Fix Report

**Fixed at:** 2026-04-27T06:43:13Z
**Source review:** .planning/phases/15-resend-heygrabit-com-cutover-transactional-email-secret-mana/15-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 1 (1 warning, 0 critical)
- Fixed: 0
- Skipped: 1

## Fixed Issues

None — the single in-scope warning was deferred (see Skipped Issues).

## Skipped Issues

### WR-01: No retry on transient Resend failures; caller-side swallow makes single-attempt failures permanent

**File:** `apps/api/src/modules/auth/email/email.service.ts:71-92`
**Reason:** Architectural decision deferred to follow-up phase. The reviewer explicitly classified this as a policy question rather than a Phase 15 defect: "this is not a bug introduced by Phase 15 — the single-attempt pattern predates this phase ... Flagging as a warning so the team can decide whether retry belongs in this phase or a follow-up." The two suggested fix options carry materially different implications and an automated fixer should not pick between them:

1. **Option A (in-process exponential backoff):** Lightweight but does not survive process death. On Cloud Run with `min-instances=0` (per CLAUDE.md), instances can be reaped mid-retry, leaving the user without a reset email and no recovery path. Also stretches request latency by up to ~750ms on the failure path while the caller still returns the generic enumeration-defense response.
2. **Option B (pg-boss enqueue, "preferred long-term"):** Matches the documented job-queue stack in CLAUDE.md (`pg-boss 12.14.x`, "PostgreSQL-native job queue ... automatic retries with exponential backoff"). However, pg-boss is not yet wired into this module — adopting it requires a new job handler, queue registration, and a non-trivial change to the auth flow. That is a new feature, not a cutover hardening fix.

Phase 15's scope is the Resend cutover and secret hardening (per the phase title and the REVIEW summary's focus areas). Layering retry semantics on top would expand scope and force an architecture choice (Option A vs Option B) that the reviewer deliberately escalated to humans. Recommend opening a follow-up phase for "transactional email retry / pg-boss integration" and tracking WR-01 there.

**Original issue:** `sendPasswordResetEmail` makes exactly one call to `this.resend!.emails.send(...)`. A single transient Resend failure (rate limit, 5xx, network blip) results in a permanently undelivered password reset because `auth.service` intentionally swallows the result for enumeration defense. The Sentry capture gives ops visibility but does not recover the user.

---

_Fixed: 2026-04-27T06:43:13Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
