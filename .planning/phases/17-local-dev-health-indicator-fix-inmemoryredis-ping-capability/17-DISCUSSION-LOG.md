# Phase 17: Local dev health indicator fix - InMemoryRedis.ping() capability probe - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 17-local-dev-health-indicator-fix-inmemoryredis-ping-capability
**Areas discussed:** Local Smoke Contract, Fallback Boundary, Production Safety, Post-Facto Context Handling

---

## Local Smoke Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Unit coverage canonical + smoke preferred | Treat existing focused/full automated verification as the completed phase pass signal; recommend live local smoke when convenient and record residual risk if omitted. | ✓ |
| Live smoke hard gate | Require starting the local API with `REDIS_URL` unset and curling `/api/v1/health` before context can be considered complete. | |
| No smoke mention | Rely only on `17-VERIFICATION.md` and avoid adding any operational smoke guidance. | |

**User's choice:** User selected this area for capture (`1`).
**Notes:** The phase is already complete and verified. `17-VERIFICATION.md` explicitly records that no live smoke was run, so the context preserves that as residual risk rather than retroactively blocking completion.

---

## Fallback Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal parity with tests | Add only methods required by real local/test paths, with focused tests and explicit production-safety guards. | ✓ |
| Full Redis mock | Grow `InMemoryRedis` toward broad Redis compatibility proactively. | |
| Freeze mock surface | Do not add any more fallback methods after `ping()`, even if future local/test paths need them. | |

**User's choice:** User selected this area for capture (`2`).
**Notes:** The context locks the distinction between allowed `ping()` parity and intentionally absent `incr()`, because `AppModule` throttler fallback detection depends on the latter.

---

## Production Safety

| Option | Description | Selected |
|--------|-------------|----------|
| Strong production guard wording | Explicitly state that local fallback `up` behavior cannot mask production missing `REDIS_URL`, rejected `ping()`, or non-`PONG` responses. | ✓ |
| Light mention | Briefly note that production should remain safe without enumerating conditions. | |
| Dev-first framing | Prioritize local developer convenience and leave production safety to existing code comments. | |

**User's choice:** User selected this area for capture (`3`).
**Notes:** This phase touches a health endpoint used by Cloud Run, so production safety is part of the decision contract, not incidental commentary.

---

## Post-Facto Context Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Post-facto decision record | Mark `CONTEXT.md` as complete/post-facto and use existing plan, summary, and verification artifacts as authoritative execution records. | ✓ |
| Normal pre-planning context | Pretend the phase is still before planning and mark context as ready for planning. | |
| Skip context write | Do not create context because phase has already been executed. | |

**User's choice:** User selected this area for capture (`4`).
**Notes:** Phase 17 already has two completed plans and passed verification. The context therefore documents decisions and maintenance boundaries for future reopen/audit work.

---

## the agent's Discretion

- Exact future live-smoke evidence format is flexible as long as command, environment, result, and timestamp are captured.
- Future regression test placement is flexible but should stay close to the behavior under test.

## Deferred Ideas

None.
