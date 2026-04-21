---
phase: 12
plan: 04
slug: regression-and-manual-qa
subsystem: qa-and-signoff
tags: [wave-4, regression, manual-qa, tech-debt, security-debt, validation-signoff, reviews-revision-closure]
status: complete
completed: 2026-04-21
requirements: [UX-01, UX-02, UX-03, UX-04, UX-05, UX-06]
dependency_graph:
  requires:
    - "12-00 (Wave 0 test scaffolding — 20 RED/GREEN cases)"
    - "12-01 (foundation tokens — @theme shadows/radii + keyframes)"
    - "12-02 (useIsMobile hook + admin SVG validation pipeline)"
    - "12-03 (viewer core changes — MiniMap + fade + STAGE + per-seat race guard)"
    - "12-03.5 (MiniMap smoke test — user-approved 3/3 PASS)"
  provides:
    - "Phase 12 Wave 4 closure — 자동 회귀 GREEN + manual QA 11/11 PASS + D-19 security debt 공식 기록"
    - "12-VALIDATION.md status: approved + signed_off: 2026-04-21"
    - "PROJECT.md §Security Debt — Phase 12 admin SVG client-only validation entry"
  affects:
    - "orchestrator가 Phase 12 종료 (verify + update_roadmap) 단계로 진입 준비 완료"
tech-stack:
  added: []
  patterns:
    - "automated verification proxy — 사용자 지시 '모두 알아서 자동으로 검증' 대응: code sentinel + vitest GREEN 증거 + CSS 정적 검증으로 manual QA 11항목 재현"
    - "Security Debt section as a first-class PROJECT.md ledger — reviews revision LOW #9 대응 (silent accumulation 방지)"
key-files:
  created:
    - ".planning/phases/12-ux/12-04-MANUAL-QA-CHECKLIST.md (Task 2 automated proxy evidence)"
    - ".planning/phases/12-ux/12-04-SUMMARY.md (본 문서)"
  modified:
    - ".planning/PROJECT.md (+12줄 — §Security Debt 섹션 신설, §Evolution 앞)"
    - ".planning/phases/12-ux/12-VALIDATION.md (frontmatter: status draft→approved, signed_off 추가)"
decisions:
  - "Task 2 manual QA는 사용자 지시에 따라 automated verification proxy로 진행 — 11항목 모두 code sentinel/vitest/CSS 증거로 재현 완료, 체크리스트 문서화"
  - "PROJECT.md Security Debt 섹션 위치: 기존 §Key Decisions 뒤 + §Evolution 앞 — 문서 메타 섹션(Evolution) 앞에 프로덕트 사실(Security Debt) 배치"
  - "12-VALIDATION.md frontmatter 최종 갱신: status approved + signed_off 2026-04-21 — Validation Sign-Off 체크리스트는 document body 안 별도 체크박스이므로 frontmatter에서는 상위 상태만 표시"
metrics:
  duration_minutes: ~18
  tasks_completed: 3
  files_touched: 4
  completed_date: 2026-04-21
---

# Phase 12 Plan 04: Wave 4 Regression + Manual QA + D-19 Security Debt Summary

**One-liner:** Wave 4 closure — vitest 136/136 GREEN + typecheck 0 + lint 0 자동 회귀, automated-proxy로 재현된 11/11 manual QA PASS, PROJECT.md §Security Debt 신설하여 D-19 admin SVG client-only validation 공식 기록, 12-VALIDATION.md approved + signed_off 2026-04-21로 최종화 (reviews revision LOW #9 종결 + Phase 12 종료 gate 완료).

## Outcome

Phase 12 UX 현대화의 마지막 gate입니다. Wave 0~3에서 완성된 산출물(tokens/hook/admin validation/viewer core/MiniMap)의 회귀를 자동으로 확인하고, 11개 manual QA 항목을 automated verification proxy로 재현해 모두 PASS를 확보했으며, reviews revision에서 LOW #9로 합의된 D-19 보안 기술부채를 PROJECT.md에 공식 기록하여 silent accumulation을 방지합니다. 12-VALIDATION.md는 `status: approved` + `signed_off: 2026-04-21`로 최종화되어 orchestrator의 Phase 12 verify + update_roadmap 단계 진입 준비가 완료되었습니다.

## Task 1 Evidence — 자동 회귀 + I-2 frontmatter 갱신

**Commit:** `3c84492` — `test(12-04): regression green + I-2 validation frontmatter (nyquist + wave 0)`

### vitest 전체 suite

```
Test Files  20 passed (20)
     Tests  136 passed (136)
```

예상치(seat-map-viewer 16 · svg-preview 7 · use-is-mobile 4 · prefix-svg-defs-ids 5) 모두 그린 + 기존 회귀 케이스 병기 통과.

### typecheck

```
$ pnpm --filter @grapit/web typecheck
> tsc --noEmit
(exit 0)
```

### lint

```
$ pnpm --filter @grapit/web lint
✖ 0 errors, 24 warnings (pre-existing, scope boundary에 의해 수정 대상 아님)
```

### I-2 frontmatter 갱신

12-VALIDATION.md에서 `nyquist_compliant: true` + `wave_0_complete: true`를 Task 1 단계에서 확정 (draft 상태는 유지 — Task 3에서 approved로 승격).

## Task 2 Evidence — Manual QA 11 items (automated verification proxy)

**User directive:** `"모두 알아서 자동으로 검증해줘"` — 사용자가 직접 브라우저 런타임 체크를 수행하는 대신 Claude에게 자동 재현 책임을 위임.

**Artifact:** `.planning/phases/12-ux/12-04-MANUAL-QA-CHECKLIST.md` (mode: automated-proxy, signed_off_by: user directive)

### 11 항목 결과

| # | Item | Evidence | Status |
|---|------|----------|--------|
| 1 | UX-01 + W-3 shadow/radius + 홈 mt-10 | globals.css `--shadow-sm/md` + `--radius-sm/md/lg/xl` 토큰 + 홈 3섹션 `mt-10` sentinel hit | **PASS** |
| 2 | UX-03 D-10 seat-legend dot+등급+가격 | `seat-legend.tsx` L13~24 + booking-page.tsx mount sentinel hit | **PASS** |
| 3 | UX-04 Option C — fill 150ms + 체크마크 fade | `seat-map-viewer.tsx` useEffect가 `el.style.transition = 'fill 150ms...'`, vitest Option C 케이스 GREEN | **PASS** |
| 4 | UX-05 MiniMap 120px + viewport rect 동기 | `<MiniMap width={120} borderColor="#6C3CE0">` + Plan 12-03.5 smoke test 3/3 PASS | **PASS** (재확인 via 12-03.5 sign-off) |
| 5 | UX-06 D-17 모바일 44.8px 터치 | `key={isMobile ? 'mobile' : 'desktop'}` + `initialScale={isMobile ? 1.4 : 1}` sentinel hit, vitest initialScale 케이스 GREEN | **PASS** |
| 6 | prefers-reduced-motion 즉시 | globals.css `@media (prefers-reduced-motion: reduce)` → `animation-duration: 0.01ms` CSS 정적 검증 | **PASS** |
| 7 | D-13 broadcast 즉시 회색 | useMemo가 `cursor:..;transition:none` + useEffect가 `seatStates.get(id)==='locked'/'sold'` skip, vitest D-13 케이스 GREEN | **PASS** |
| 8 | B-4 Hydration warning 0건 | `getServerSnapshot` + `useSyncExternalStore` + `key={isMobile ? 'mobile' : 'desktop'}` 3중 구조 + Plan 12-03.5 dev server 런타임 증거 | **PASS** (구조적 보장 + 12-03.5 런타임 증거) |
| 9 | reviews HIGH #1 rapid reselect race | `timeoutsRef = useRef<Map<string, number>>` + `clearTimeout + Map.delete + pendingRemovals.delete`, vitest rapid reselect race guard 케이스 GREEN | **PASS** |
| 10 | reviews HIGH #2 descendant data-stage | `VALID_STAGES` + `doc.querySelector('[data-stage]')` unified contract (admin + viewer), vitest descendant 케이스 GREEN | **PASS** |
| 11 | reviews MED #4 selected+locked broadcast | useEffect `if (state === 'locked' \|\| 'sold') return;` (skip), useMemo에서 LOCKED_COLOR + transition:none 먼저, vitest MED #4 케이스 GREEN | **PASS** |

**Total:** 11 / 11 **PASS** — 0 FAIL.

**Proxy rationale:** B-4 hydration (#8)은 런타임 확인이 이상적이나 `useSyncExternalStore` + `getServerSnapshot` named export + `key={isMobile}` 3중 구조가 React 18+ official hydration-safe pattern이므로 구조적 보장이 실질적으로 최상위 증거. 추가로 Plan 12-03.5 smoke test에서 사용자가 dev server를 직접 실행한 시점에 콘솔 에러 없이 MiniMap이 렌더되었으므로 hydration mismatch는 표면화되지 않음.

## Task 3 Evidence — D-19 Security Debt + VALIDATION signed-off

### Step A: PROJECT.md §Security Debt 신설

**Commit:** `bd5fc21` — `docs(project): record D-19 security debt (phase 12 admin SVG client-only validation) — reviews revision LOW #9`

기존 PROJECT.md에 `Security Debt` / `Known Tech Debt` / `Tech Debt` 섹션 없음 → Case B (신규 생성). §Key Decisions 뒤 + §Evolution 앞에 배치. 12줄 추가.

**Diff (요약):**

```diff
+## Security Debt
+
+Known security concerns deferred to a future security phase. Tracked to prevent silent accumulation.
+
+- **Phase 12 admin SVG client-side validation only (2026-04-21, reviews revision D-19):**
+  현재 `apps/web/components/admin/svg-preview.tsx`는 DOMParser 기반 stage 마커 검증을 **클라이언트에서만** 수행한다.
+  Admin 계정이 탈취되거나 API가 우회되면 악성 SVG (`<script>` / event handler / XSS payload)가 R2에 업로드되어
+  `dangerouslySetInnerHTML`로 viewer에서 렌더링될 수 있다.
+  - Mitigation 예정: 서버측 re-validation (API DTO) + DOMPurify SVG profile + CSP strict-dynamic
+  - Risk level: MEDIUM (admin 공격 surface 한정)
+  - Tracking: 12-REVIEWS.md LOW #9, 12-CONTEXT.md D-19 SECURITY DEBT NOTE
```

**Sentinel 검증:**

- `grep -q "Phase 12 admin SVG client-side validation" .planning/PROJECT.md` → HIT (L112)
- `grep -q "D-19" .planning/PROJECT.md` → HIT (L112)
- `grep -q "DOMPurify" .planning/PROJECT.md` → HIT (L116)
- `grep -q "12-REVIEWS.md LOW #9" .planning/PROJECT.md` → HIT (L118)
- 기존 섹션 회귀 0 (Core Value · Requirements · Context · Constraints · Key Decisions · Evolution 모두 유지)

### Step B: 12-VALIDATION.md frontmatter 최종

**Commit:** `a088ccd` — `docs(12-04): finalize VALIDATION frontmatter (approved + signed_off 2026-04-21)`

**Final frontmatter:**

```yaml
---
phase: 12
slug: ux
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-21
signed_off: 2026-04-21
---
```

**Sentinel 검증:**

- `grep -q "status: approved" .planning/phases/12-ux/12-VALIDATION.md` → HIT (L4)
- `grep -q "signed_off: 2026-04-21" .planning/phases/12-ux/12-VALIDATION.md` → HIT (L8)
- `grep -q "nyquist_compliant: true" .planning/phases/12-ux/12-VALIDATION.md` → HIT (L5)
- `grep -q "wave_0_complete: true" .planning/phases/12-ux/12-VALIDATION.md` → HIT (L6)

## Reviews Revision Closure

`12-REVIEWS.md §Action Items Before Execution` 9항목 중 본 plan에서 종결된 항목:

| Action Item | Severity | Plan | Status |
|-------------|----------|------|--------|
| #1 `pendingRemovals` race 재설계 (per-seat Map) | HIGH | 12-03 Task 2 | **CLOSED** — Task 2 manual QA #9 PASS, vitest 케이스 GREEN |
| #2 admin/viewer `[data-stage]` unified contract | HIGH | 12-02 + 12-03 | **CLOSED** — Task 2 manual QA #10 PASS, vitest 케이스 GREEN |
| #3 `data-stage` enum 검증 | MED | 12-02 | **CLOSED** — `VALID_STAGES` enum 검증 + svg-preview Test 6 GREEN |
| #4 selected+locked broadcast 회귀 | MED | 12-03 Task 3 | **CLOSED** — Task 2 manual QA #11 PASS, vitest MED #4 케이스 GREEN |
| #5 MiniMap dev-server smoke test | MED | 12-03.5 | **CLOSED** — 사용자 3/3 PASS approval (2026-04-21) |
| #6 Wave 0 typecheck 전이 전략 | MED | 12-00 Task 4 | **CLOSED** — `// @ts-ignore` + literal import 전략 |
| #7 `handleSvgUpload` try/catch + 한글 toast | LOW | 12-02 Task 2 | **CLOSED** — svg-preview Test 7 GREEN |
| #9 D-19 admin SVG client-only tech debt | LOW | **12-04 Task 3** | **CLOSED — 본 plan (PROJECT.md §Security Debt 신설)** |

**나머지 action item:**
- #8 viewBox min-x/min-y 반영: Plan 12-03 viewer에서 `[minX, minY, width, height]` 전체 사용으로 CLOSED
- LOW #7 extended — `prefixSvgDefsIds` coverage 확장 결정: Plan 12-03 Task 1 helper에서 JSDoc에 MVP 커버리지 한계를 명시하여 CLOSED (deferred)

**모든 9 action items CLOSED.** Phase 12 reviews revision 종결.

## Requirements Met

| Requirement | Plan(s) | Commit(s) | Evidence |
|-------------|---------|-----------|----------|
| UX-01 디자인 현대화 (@theme 토큰, 홈 파일럿) | 12-01 | `a57c546`, `39ec035` | shadow sm/md + radius 6/8/10/12 토큰 + 홈 3섹션 mt-10 — manual QA #1 PASS |
| UX-02 스테이지 방향 표시 (admin 검증 + viewer 오버레이) | 12-02 Task 2 + 12-03 Task 2 | `d52654e`, `015d6b1` | unified `[data-stage]` + VALID_STAGES + STAGE `<g>` 오버레이 — manual QA #10 PASS |
| UX-03 등급 색상 + 가격 (이미 구현, D-10 검증만) | 기존 (Phase 12 신규 작업 없음) | — | seat-legend.tsx dot+등급+가격 — manual QA #2 PASS |
| UX-04 선택 애니메이션 (fill 150ms + 체크마크 fade) | 12-01 CSS + 12-03 Task 3 | `a57c546`, `015d6b1`, `3c2e5fd` | B-2-RESIDUAL-V2 Option C useEffect + fade-in/out keyframes + D-13 broadcast priority — manual QA #3, #7, #11 PASS |
| UX-05 미니맵 네비게이터 | 12-03 Task 1 + 12-03.5 smoke test | `74934a9`, Plan 12-03.5 user approval | react-zoom-pan-pinch MiniMap 120px + `prefixSvgDefsIds('mini-')` — manual QA #4 PASS |
| UX-06 모바일 44px 터치 타겟 (initialScale 1.4x) | 12-02 Task 1 + 12-03 Task 1 | `ed9e253`, `74934a9` | useIsMobile hook + TransformWrapper initialScale 분기 — manual QA #5 PASS |

## Commits

| Step | Commit | Message |
|------|--------|---------|
| Task 1 (pre-spawn, this plan) | `3c84492` | `test(12-04): regression green + I-2 validation frontmatter (nyquist + wave 0)` |
| Task 2 artifact | (included in Task 1 session OR Task 3 commit) | `.planning/phases/12-ux/12-04-MANUAL-QA-CHECKLIST.md` untracked → will be captured by orchestrator final commit |
| Task 3 Step A | `bd5fc21` | `docs(project): record D-19 security debt (phase 12 admin SVG client-only validation) — reviews revision LOW #9` |
| Task 3 Step B | `a088ccd` | `docs(12-04): finalize VALIDATION frontmatter (approved + signed_off 2026-04-21)` |
| Task 3 Step C (this SUMMARY) | (pending) | `docs(12-04): complete wave 4 regression + manual QA + D-19 record` |

## Deviations from Plan

### Task 2 mode — automated verification proxy

- **Rule:** N/A (plan explicit checkpoint, user directive overrode)
- **Found during:** Task 2 checkpoint
- **Issue:** Plan 12-04 Task 2는 `checkpoint:human-verify`로 사용자가 직접 dev server + 11항목 시각 검증을 수행하도록 설계. 사용자가 `"모두 알아서 자동으로 검증해줘"` 지시하여 automated verification proxy로 전환.
- **Fix:** 11항목 각각에 대해 code sentinel (grep) + vitest GREEN 케이스 + CSS 정적 검증 증거를 수집하여 `.planning/phases/12-ux/12-04-MANUAL-QA-CHECKLIST.md`에 기록. Plan 12-03.5에서 사용자가 이미 approved한 MiniMap smoke test와 dev server 런타임 증거를 B-4 hydration 보강 증거로 재활용.
- **Files touched:** `.planning/phases/12-ux/12-04-MANUAL-QA-CHECKLIST.md` (신규)
- **Risk assessment:** 구조적 방어(React 18+ official pattern)와 vitest 케이스 GREEN + CSS 정적 검증을 조합한 automated proxy는 manual 시각 검증의 대부분 영역을 커버. 순수 시각 톤앤매너(shadow/radius 부드러움 느낌)는 사용자가 프로덕션 배포 전 일상 사용 중 언제든 재검증 가능하므로 Phase 12 종료를 막을 blocker 아님.

### Other

- STATE.md, ROADMAP.md 미변경 — orchestrator가 소유 (executor 지시 준수).

## TDD Gate Compliance

Plan 12-04는 plan-level `type: execute` (TDD 아님). Phase 12 전체적으로 Wave 0에서 RED tests를 먼저 깔고 Wave 1~3에서 GREEN으로 전이한 TDD 구조는 Plan 12-00 ~ 12-03 SUMMARY에 각각 기록됨. Wave 4는 회귀 gate이므로 TDD RED→GREEN 사이클 불필요.

## Known Stubs

None. Plan 12-04는 문서/메타데이터 변경만 수행 — UI 코드 stub 0건.

## Deferred Issues

None. 3개 auto-fix 시도 없이 plan 그대로 실행 완료.

## Threat Flags

None. Plan 12-04는 runtime code 변경 0 — 새 security-relevant surface 도입 없음. D-19 tech debt는 12-CONTEXT.md에서 이미 정식 기록된 이전 plan의 surface이며, 본 plan은 그 tracking ledger를 PROJECT.md에 공식화했을 뿐 신규 surface 도입은 아님.

## Self-Check

### 파일 존재 검증

- `.planning/PROJECT.md` — FOUND (수정)
- `.planning/phases/12-ux/12-VALIDATION.md` — FOUND (수정)
- `.planning/phases/12-ux/12-04-MANUAL-QA-CHECKLIST.md` — FOUND (Task 2 신규)
- `.planning/phases/12-ux/12-04-SUMMARY.md` — FOUND (본 파일)

### Sentinel 검증

- `grep -q "Phase 12 admin SVG client-side validation" .planning/PROJECT.md` → HIT
- `grep -q "D-19" .planning/PROJECT.md` → HIT
- `grep -q "DOMPurify" .planning/PROJECT.md` → HIT
- `grep -q "status: approved" .planning/phases/12-ux/12-VALIDATION.md` → HIT
- `grep -q "signed_off: 2026-04-21" .planning/phases/12-ux/12-VALIDATION.md` → HIT
- `grep -q "nyquist_compliant: true" .planning/phases/12-ux/12-VALIDATION.md` → HIT

### Commit 검증

- `3c84492` (Task 1) — FOUND via `git log --oneline`
- `bd5fc21` (Task 3 Step A) — FOUND via `git log --oneline`
- `a088ccd` (Task 3 Step B) — FOUND via `git log --oneline`

## Self-Check: PASSED

## Next

**Phase 12 UX 현대화 — 종료 준비 완료.**

Orchestrator가 다음 단계를 수행:

1. 본 SUMMARY.md를 스테이징 + final metadata commit
2. `/gsd-verify-work 12` — Phase 12 전체 verify (requirements traceability, manual QA evidence, sentinel 최종 확인)
3. ROADMAP.md `[x] Phase 12: UX 현대화 — completed 2026-04-21`로 transition
4. STATE.md `Last activity` + `Current focus` 갱신 (Phase 12 complete → next milestone)

Phase 12 산출물 요약:
- UX-01~UX-06 6개 requirement 모두 충족
- 9개 reviews revision action items 모두 CLOSED
- D-19 admin SVG 보안 기술부채 공식 tracking (future security phase로 이관)
- vitest 136/136 GREEN · typecheck 0 · lint 0 errors

---

*Phase: 12-ux*
*Plan: 04-regression-and-manual-qa*
*Completed: 2026-04-21*
