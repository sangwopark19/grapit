---
phase: 12
plan: 04
plan_number: 4
type: execute
wave: 4
depends_on: ["12-01", "12-02", "12-03", "12-03.5"]
files_modified:
  - .planning/phases/12-ux/12-VALIDATION.md
  - .planning/PROJECT.md
autonomous: false
requirements: [UX-01, UX-02, UX-03, UX-04, UX-05, UX-06]
must_haves:
  truths:
    - "web vitest suite passes (svg-preview 7 + use-is-mobile 4 + prefix-svg-defs-ids 5 + seat-map-viewer 16 = 기존 6 plus 신규 10)"
    - "typecheck zero errors"
    - "lint zero errors"
    - "Manual QA 11 items PASS including reviews revision HIGH-1 HIGH-2 MED-4"
    - "12-VALIDATION.md frontmatter updated - nyquist_compliant true wave_0_complete true status approved signed_off"
    - "D-19 SECURITY DEBT recorded in PROJECT.md per reviews revision LOW-9"
  artifacts:
    - path: ".planning/phases/12-ux/12-04-MANUAL-QA-CHECKLIST.md"
      provides: "Manual QA 11 item results"
      contains: "PASS/FAIL notes"
    - path: ".planning/phases/12-ux/12-VALIDATION.md"
      provides: "frontmatter approved + signed-off"
      contains: "status approved signed_off date"
    - path: ".planning/PROJECT.md"
      provides: "Security Debt footnote for Phase 12 admin SVG"
      contains: "Security Debt section with Phase 12 entry"
  key_links:
    - from: "manual QA result"
      to: "12-VALIDATION.md Approval signed-off"
      via: "Task 2 user sign-off + Task 3 frontmatter update"
      pattern: "status approved"
    - from: "Task 3 tech debt record"
      to: "PROJECT.md Security Debt section"
      via: "section append"
      pattern: "Phase 12 admin SVG"
---

<objective>
Wave 4 — 회귀 검증 + 수동 QA gate + D-19 security debt 공식 기록.

Plan 12-01/12-02/12-03 + 12-03.5 MiniMap smoke test gate 완료 후 phase 종료 직전 단계.

Purpose:
- 자동 회귀 + 수동 QA 완료
- reviews revision HIGH #1 (rapid reselect race guard) + HIGH #2 (descendant data-stage) + MED #4 (D-13 broadcast priority) manual 검증
- 12-VALIDATION.md Approval signed-off 전환
- **reviews revision LOW #9**: D-19 tech debt를 PROJECT.md에 공식 기록

Output:
- (선택) `.planning/phases/12-ux/12-04-MANUAL-QA-CHECKLIST.md`
- 12-VALIDATION.md frontmatter 갱신
- **.planning/PROJECT.md §"Security Debt" 섹션에 Phase 12 admin SVG XSS 잔존 언급 추가**
- web suite + typecheck + lint 결과 캡처
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/12-ux/12-CONTEXT.md
@.planning/phases/12-ux/12-VALIDATION.md
@.planning/phases/12-ux/12-UI-SPEC.md
@.planning/phases/12-ux/12-REVIEWS.md
@.planning/phases/12-ux/12-00-SUMMARY.md
@.planning/phases/12-ux/12-01-SUMMARY.md
@.planning/phases/12-ux/12-02-SUMMARY.md
@.planning/phases/12-ux/12-03-SUMMARY.md
@.planning/phases/12-ux/12-03.5-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: 자동 회귀 — web suite + typecheck + lint 풀 실행 + 12-VALIDATION.md frontmatter 갱신 (I-2)</name>
  <files>.planning/phases/12-ux/12-VALIDATION.md</files>
  <read_first>
    - .planning/phases/12-ux/12-VALIDATION.md §"Sampling Rate" + frontmatter 현재 값
    - .planning/phases/12-ux/12-VALIDATION.md §"Per-Task Verification Map"
    - .planning/phases/12-ux/12-00-SUMMARY.md, 12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md, 12-03.5-SUMMARY.md
  </read_first>
  <action>
**Step A: 자동 회귀 실행**

```bash
cd /Users/sangwopark19/icons/grapit
pnpm --filter @grapit/web test --run 2>&1 | tail -50
pnpm --filter @grapit/web typecheck 2>&1 | tail -10
pnpm --filter @grapit/web lint 2>&1 | tail -20
```

세 명령 모두 exit 0.

**기대:**
- `seat-map-viewer.test.tsx` 16 PASS (기존 6 + 신규 10)
- `svg-preview.test.tsx` 7 PASS
- `use-is-mobile.test.ts` 4 PASS
- `prefix-svg-defs-ids.test.ts` 5 PASS

**Step B: 12-VALIDATION.md frontmatter 갱신 (I-2)**

`nyquist_compliant: true` + `wave_0_complete: true`만 갱신 (status/signed_off는 Task 3에서 최종).
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web test --run 2>&1 | tail -10 && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && grep -q "nyquist_compliant: true" .planning/phases/12-ux/12-VALIDATION.md && grep -q "wave_0_complete: true" .planning/phases/12-ux/12-VALIDATION.md</automated>
  </verify>
  <acceptance_criteria>
    - vitest exit 0, typecheck exit 0, lint error 0
    - `grep -q "nyquist_compliant: true" .planning/phases/12-ux/12-VALIDATION.md`
    - `grep -q "wave_0_complete: true" .planning/phases/12-ux/12-VALIDATION.md`
  </acceptance_criteria>
  <done>
자동 회귀 GREEN. nyquist/wave_0 갱신. Task 2로 진행.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Manual QA Gate — 11개 검증 (reviews revision HIGH #1/#2 + MED #4 포함)</name>
  <files>(no file changes — manual verification gate)</files>
  <action>
사용자가 dev server를 실행하고 아래 11개 검증 시나리오를 직접 수행. Claude는 사용자가 "approved" 또는 FAIL 항목을 응답할 때까지 대기.
  </action>
  <verify>
    <automated>echo "manual checkpoint — awaiting user sign-off"</automated>
  </verify>
  <done>사용자가 11개 항목 모두 PASS 확인 + "approved" 응답.</done>
  <what-built>
1. globals.css 토큰으로 shadcn elevation·radius modernize (DevTools Computed — W-3)
2. 홈 섹션 mt-12 → mt-10
3. seat-legend dot + 등급명 + 가격 (UX-03 D-10)
4. 좌석 클릭 fill tier→primary fade (150ms — B-2-RESIDUAL-V2 Option C) + 체크마크 fade-in + 해제 fade-out + 다른 좌석 transition:none
5. 데스크톱 미니맵 viewport rect 동기 (Plan 12-03.5 smoke test 재확인)
6. 모바일 44px 터치
7. prefers-reduced-motion 즉시
8. D-13 broadcast 즉시 플립
9. **B-4 Hydration warning 0건**
10. **reviews revision HIGH #1**: 빠른 해제→재선택 시 data-fading-out stuck 없음
11. **reviews revision HIGH #2**: `<g data-stage>` descendant SVG viewer 렌더링
12. **reviews revision MED #4**: 선택 좌석이 broadcast로 locked 시 즉시 회색 (primary 덮어쓰지 않음)
  </what-built>
  <how-to-verify>
**준비:**
1. `cd /Users/sangwopark19/icons/grapit && pnpm dev`
2. 브라우저 두 개 (admin + 일반)
3. 모바일 디바이스 1대

──────

**검증 1 (UX-01 + W-3 DevTools):** `/admin/dashboard` 카드 shadow/radius → DevTools Computed `box-shadow` 값 일치:
   - shadow-sm: `rgba(0, 0, 0, 0.05) 0px 1px 2px 0px`
   - shadow-md: `rgba(0, 0, 0, 0.08) 0px 4px 12px -2px`
   - border-radius 8/10/12px
홈(`/`) 섹션 mt-10 (40px).

**검증 2 (UX-03 D-10):** seat-legend dot + 등급명 + "N,NNN원".

**검증 3 (UX-04 + B-2-RESIDUAL-V2 Option C):**
- 좌석 클릭 → rect fill tier→primary(#6C3CE0) 150ms fade + 체크마크 fade-in
- 재클릭(해제) → primary→tier 150ms fade + 체크마크 fade-out (150ms 후 DOM 제거)
- DevTools Elements: 선택 rect에 `transition: fill 150ms ease-out, stroke 150ms ease-out` inline style 확인

**FAIL 시:** rect fill 즉시 변경 → Plan 12-03 Task 3 useEffect 확인.

**검증 4 (UX-05):** 데스크톱 좌상단 미니맵 + viewport rect 동기 (이미 Plan 12-03.5 smoke test에서 검증됨 — 재확인).

**검증 5 (UX-06 D-17):** 모바일에서 첫 paint 좌석 44.8px (32×1.4), 탭 정확도 100%, 데스크톱 32px.

**검증 6 (reduced-motion):** macOS Reduce Motion ON 또는 Chrome DevTools "Emulate prefers-reduced-motion: reduce" → 체크마크 선택/해제 모두 즉시.

**검증 7 (D-13 broadcast):** 탭 B에서 좌석 lock → 탭 A에서 fade 없이 즉시 회색.

**검증 8 (B-4 Hydration):** dev 재시작 → 콘솔에 Hydration warning 0건. 모바일 viewport에서도 동일. FAIL 시 `git diff apps/web/hooks/use-is-mobile.ts apps/web/components/booking/seat-map-viewer.tsx`.

**검증 9 (reviews revision HIGH #1 — rapid reselect):**
1. 좌석 A-1 선택
2. **80~100ms 이내** A-1 해제 → 즉시 재선택
3. A-1이 정상 selected:
   - fill primary, 체크마크 표시
   - **DevTools Elements에서 체크마크 `<text>`에 `data-fading-out="true"` 없음**
4. 200ms 더 대기 → 체크마크 여전히 표시

**FAIL 시:** 체크마크 투명/사라짐 → Plan 12-03 Task 2 per-seat timeout Map revision.

**검증 10 (reviews revision HIGH #2 — descendant data-stage viewer):**
1. 어드민 페이지에서 descendant data-stage SVG 업로드:
   ```svg
   <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
     <g data-stage="right">
       <rect data-seat-id="A-1" x="10" y="10" width="32" height="32"/>
     </g>
   </svg>
   ```
2. Admin 업로드 통과
3. 동일 공연 viewer → **우측**에 STAGE 배지

**FAIL 시:** Plan 12-03 Task 2 `querySelector('[data-stage]')` descendant 탐색 확인.

**검증 11 (reviews revision MED #4 — selected+locked broadcast):**
1. 탭 A에서 A-1 선택 (primary 색)
2. 탭 B에서 A-1 lock
3. 탭 A에서 A-1:
   - **즉시 회색 (LOCKED_COLOR)**
   - **primary 색으로 덮어쓰지 않음**
   - transition 없음

**FAIL 시:** Plan 12-03 Task 3 useEffect의 `seatStates.get(seatId)` 체크 누락 → D-13 BROADCAST PRIORITY 구현 확인.

──────

**결과 기록 (선택):** `.planning/phases/12-ux/12-04-MANUAL-QA-CHECKLIST.md` 생성.

**FAIL 처리:**
- UX-01 / W-3 → Plan 12-01
- UX-04 transition → Plan 12-03 Task 3
- UX-04 fade-in → Plan 12-01 또는 Plan 12-03 Task 2
- UX-05 → Plan 12-03.5 smoke test 재실행 (이미 1차 검증됨)
- UX-06 → Plan 12-02 hook / Plan 12-03 TransformWrapper
- D-13 → Plan 12-03 Task 2 transition:none
- B-4 → Plan 12-02 / Plan 12-03 SSR
- HIGH #1 stuck → Plan 12-03 Task 2 per-seat timeout Map
- HIGH #2 descendant → Plan 12-03 Task 2 querySelector
- MED #4 → Plan 12-03 Task 3 seatStates 체크
  </how-to-verify>
  <resume-signal>
"approved" 입력 시 → Task 3 (D-19 tech debt + VALIDATION.md signed-off).
  </resume-signal>
</task>

<task type="auto">
  <name>Task 3 (reviews revision LOW #9): D-19 SECURITY DEBT를 PROJECT.md에 공식 기록 + 12-VALIDATION.md signed-off 최종 갱신</name>
  <files>.planning/PROJECT.md, .planning/phases/12-ux/12-VALIDATION.md</files>
  <read_first>
    - .planning/PROJECT.md (전체 — 기존 섹션 구조, "Security Debt"/"Known Tech Debt" 존재 여부)
    - .planning/phases/12-ux/12-CONTEXT.md D-19 + D-19 SECURITY DEBT NOTE
    - .planning/phases/12-ux/12-REVIEWS.md §"Action Items" LOW #9
  </read_first>
  <action>
**Step A (reviews revision LOW #9): PROJECT.md에 D-19 SECURITY DEBT 추가**

먼저 기존 섹션 탐색:
```bash
grep -n "Security Debt\|Known Tech Debt\|Tech Debt" .planning/PROJECT.md
```

**Case A (섹션 존재):** 해당 섹션에 append.
**Case B (섹션 부재):** 파일 끝 적절한 위치에 새 섹션 생성.

추가할 내용:
```markdown

## Security Debt

Known security concerns deferred to a future security phase. Tracked to prevent silent accumulation.

- **Phase 12 admin SVG client-side validation only (2026-04-21, reviews revision D-19):**
  현재 `apps/web/components/admin/svg-preview.tsx`는 DOMParser 기반 stage 마커 검증을 **클라이언트에서만** 수행한다.
  Admin 계정이 탈취되거나 API가 우회되면 악성 SVG (`<script>` / event handler / XSS payload)가 R2에 업로드되어
  `dangerouslySetInnerHTML`로 viewer에서 렌더링될 수 있다.
  - Mitigation 예정: 서버측 re-validation (API DTO) + DOMPurify SVG profile + CSP strict-dynamic
  - Risk level: MEDIUM (admin 공격 surface 한정)
  - Tracking: 12-REVIEWS.md LOW #9, 12-CONTEXT.md D-19 SECURITY DEBT NOTE
```

**Step B: 12-VALIDATION.md frontmatter 최종 갱신 (signed-off)**

기존 `status: draft` → `status: approved`, `signed_off: 2026-04-21` 추가.

최종 frontmatter:
```yaml
  ---  # (body yaml fence - not frontmatter boundary)
phase: 12
slug: ux
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-21
signed_off: 2026-04-21
  ---  # (body yaml fence - not frontmatter boundary)
```

**Step C: SUMMARY에 최종 증거**
- Task 1 자동 회귀 출력 tail
- Task 2 manual QA 11 항목 PASS/FAIL
- Task 3 PROJECT.md diff
- 12-VALIDATION.md frontmatter 최종
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -q "Phase 12 admin SVG client-side validation" .planning/PROJECT.md && grep -q "D-19" .planning/PROJECT.md && grep -q "DOMPurify" .planning/PROJECT.md && grep -q "status: approved" .planning/phases/12-ux/12-VALIDATION.md && grep -q "signed_off: 2026-04-21" .planning/phases/12-ux/12-VALIDATION.md && grep -q "nyquist_compliant: true" .planning/phases/12-ux/12-VALIDATION.md</automated>
  </verify>
  <acceptance_criteria>
    - PROJECT.md에 D-19 tech debt 추가:
      - `grep -q "Phase 12 admin SVG client-side validation" .planning/PROJECT.md`
      - `grep -q "D-19" .planning/PROJECT.md`
      - `grep -q "DOMPurify" .planning/PROJECT.md`
      - `grep -q "12-REVIEWS.md LOW #9" .planning/PROJECT.md` 또는 유사 tracking 라인
    - 12-VALIDATION.md frontmatter 최종:
      - `grep -q "status: approved" .planning/phases/12-ux/12-VALIDATION.md`
      - `grep -q "signed_off: 2026-04-21" .planning/phases/12-ux/12-VALIDATION.md`
      - `grep -q "nyquist_compliant: true" .planning/phases/12-ux/12-VALIDATION.md`
    - 기존 PROJECT.md 섹션 회귀 0 (key sections 존재 유지):
      - `grep -q "Core Value\\|Key Decisions\\|Phases" .planning/PROJECT.md`
  </acceptance_criteria>
  <done>
PROJECT.md §Security Debt에 Phase 12 admin SVG XSS 잔존 공식 기록 (reviews revision LOW #9). 12-VALIDATION.md status: approved + signed_off 2026-04-21. Phase 12 종료 gate 완료.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (없음) | Wave 4는 자동 검증 + 수동 QA + 문서 변경만 — 새 코드 표면 0. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-12-01 | Tampering | admin svg-preview | mitigate (Plan 12-02 완료) | manual QA 검증 8~11에서 재확인 |
| (관련) 악성 SVG XSS via dangerouslySetInnerHTML | Tampering/Elevation | viewer | **accept (MVP) / defer** | **reviews revision LOW #9: Task 3이 PROJECT.md §Security Debt에 공식 기록 — 별도 security phase로 deferred** |
</threat_model>

<verification>
- [ ] `pnpm --filter @grapit/web test --run` GREEN
- [ ] `pnpm --filter @grapit/web typecheck` GREEN
- [ ] `pnpm --filter @grapit/web lint` GREEN
- [ ] **I-2: 12-VALIDATION.md frontmatter `nyquist_compliant: true`, `wave_0_complete: true` 갱신 (Task 1)**
- [ ] 사용자 manual QA 11개 항목 모두 PASS — reviews revision HIGH #1/#2 + MED #4 포함
- [ ] **reviews revision LOW #9: PROJECT.md §Security Debt에 Phase 12 admin SVG XSS 잔존 기록 (Task 3)**
- [ ] 12-VALIDATION.md frontmatter `status: approved` + `signed_off: 2026-04-21` 최종 갱신 (Task 3)
</verification>

<success_criteria>
- 자동: vitest + typecheck + lint exit 0 + frontmatter 갱신
- 수동: "approved" 응답 → 11개 manual QA 항목 모두 PASS
- 12-VALIDATION.md `Validation Sign-Off` 모든 항목 체크
- **reviews revision LOW #9**: D-19 tech debt PROJECT.md에 공식 기록
- Phase 12 ROADMAP entry: `[x] Phase 12: UX 현대화 — completed YYYY-MM-DD` (별도 명령에서)
</success_criteria>

<output>
After completion, create `.planning/phases/12-ux/12-04-SUMMARY.md`:
- 자동 검증 결과 (vitest/typecheck/lint 출력 tail)
- 12-VALIDATION.md frontmatter 최종 상태 (I-2)
- Manual QA 11 항목 PASS/FAIL — reviews revision HIGH #1/#2/MED #4 포함
- (선택) `.planning/phases/12-ux/12-04-MANUAL-QA-CHECKLIST.md`
- **PROJECT.md §Security Debt diff** (reviews revision LOW #9)
- 12-VALIDATION.md Approval status `signed-off` 증거
- Phase 12 종료 준비 완료 신호
</output>
