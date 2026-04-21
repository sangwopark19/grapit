---
phase: 12
plan: 04
plan_number: 4
type: execute
wave: 4
depends_on: ["12-01", "12-02", "12-03"]
files_modified:
  - .planning/phases/12-ux/12-VALIDATION.md
autonomous: false
requirements: [UX-01, UX-02, UX-03, UX-04, UX-05, UX-06]
must_haves:
  truths:
    - "전체 web vitest suite (`pnpm --filter @grapit/web test --run`)가 0 실패로 통과 — Wave 0 신규 케이스(svg-preview 4 + use-is-mobile 4 + prefix-svg-defs-ids 5) + viewer 신규 6 케이스(B-2-RESIDUAL Option C 포함) + 기존 모든 회귀 GREEN"
    - "`pnpm --filter @grapit/web typecheck` 0 에러"
    - "`pnpm --filter @grapit/web lint` 0 에러"
    - "수동 QA: UX-01 (홈 + 어드민 카드 elevation/radius modernize, DevTools Computed box-shadow 일치 — W-3), UX-03 (seat-legend dot+등급명+가격), UX-04 (체크마크 fade-in 150ms + rect fill tier→primary 150ms + 해제 fade-out 150ms 후 DOM 제거 — UI-SPEC §Interaction + B-1 + B-2-RESIDUAL Option C, prefers-reduced-motion 즉시), UX-05 (데스크톱 미니맵 viewport rect 실시간 동기), UX-06 (모바일 디바이스 좌석 터치 ≥ 44px), D-13 (broadcast 즉시 플립), B-4 (Hydration warning 0건) 모두 사용자 검증 통과"
    - "12-VALIDATION.md `Validation Sign-Off` 6개 항목 + Manual-Only Verifications 8개 항목 모두 체크 완료"
    - "12-VALIDATION.md frontmatter `nyquist_compliant: false → true`, `wave_0_complete: false → true` 갱신 (I-2)"
  artifacts:
    - path: ".planning/phases/12-ux/12-04-MANUAL-QA-CHECKLIST.md (선택, 본 plan 결과 산출)"
      provides: "수동 QA 결과 기록 — UX-01/03/04/05/06 + D-13 + reduced-motion + B-4 hydration warning"
      contains: "각 항목 PASS/FAIL/NOTE + 스크린샷 경로 (선택)"
    - path: ".planning/phases/12-ux/12-VALIDATION.md"
      provides: "frontmatter 갱신 (nyquist_compliant: true, wave_0_complete: true) + Approval signed-off"
      contains: "nyquist_compliant: true, wave_0_complete: true, Approval: signed-off"
  key_links:
    - from: "본 plan의 manual QA 결과"
      to: "12-VALIDATION.md `Validation Sign-Off` + Manual-Only Verifications 표"
      via: "체크박스 채우기 + frontmatter 갱신 (I-2)"
      pattern: "Approval:.*pending → Approval:.*signed-off"
---

<objective>
Wave 4 — 회귀 검증 + 수동 QA gate.

Plan 12-01/12-02/12-03이 완료된 후 phase 종료 직전 단계. 자동 회귀 (web suite + typecheck + lint)와 수동 QA (시각/실디바이스/OS 설정 의존)를 한 plan으로 묶어 phase gate 역할.

Purpose:
- 12-VALIDATION.md §"Sampling Rate / Before /gsd-verify-work" 명시: "Full suite green + manual QA (UX-01 시각, UX-03 시각, UX-06 모바일 실측 디바이스 1대) 완료"
- 자동 검증으로 측정 불가능한 시각/애니메이션/터치 타겟/접근성 항목을 사용자가 직접 검증
- 12-VALIDATION.md `Validation Sign-Off` 채택 + Approval status 'signed-off'로 전환
- 12-VALIDATION.md frontmatter `nyquist_compliant: false → true`, `wave_0_complete: false → true` 갱신 (I-2)

Output:
- `.planning/phases/12-ux/12-04-MANUAL-QA-CHECKLIST.md` (선택) — 수동 QA 결과 기록
- 12-VALIDATION.md frontmatter 갱신 + `Approval` 상태 업데이트 (또는 본 plan SUMMARY에 sign-off 기록)
- web suite + typecheck + lint 결과 캡처

자동 검증 task는 Claude가 수행, 수동 QA는 사용자에게 checkpoint task로 위임 (autonomous: false).
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
@.planning/phases/12-ux/12-00-SUMMARY.md
@.planning/phases/12-ux/12-01-SUMMARY.md
@.planning/phases/12-ux/12-02-SUMMARY.md
@.planning/phases/12-ux/12-03-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: 자동 회귀 — web suite + typecheck + lint 풀 실행 + 12-VALIDATION.md frontmatter 갱신 (I-2)</name>
  <files>.planning/phases/12-ux/12-VALIDATION.md</files>
  <read_first>
    - .planning/phases/12-ux/12-VALIDATION.md §"Sampling Rate" (Per wave merge / Phase gate) + frontmatter 현재 값
    - .planning/phases/12-ux/12-VALIDATION.md §"Per-Task Verification Map" (모든 자동 검증 항목)
    - .planning/phases/12-ux/12-00-SUMMARY.md, 12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md (각 wave 결과 — 본 task가 통합 회귀 실행)
  </read_first>
  <action>
**Step A: 자동 회귀 실행**

다음 3개 명령을 순차 실행하고 결과를 캡처한다.

```bash
cd /Users/sangwopark19/icons/grapit
pnpm --filter @grapit/web test --run 2>&1 | tail -50
pnpm --filter @grapit/web typecheck 2>&1 | tail -10
pnpm --filter @grapit/web lint 2>&1 | tail -20
```

세 명령 모두 exit 0이어야 한다. 출력은 본 task SUMMARY 또는 12-04-SUMMARY.md에 인용.

**기대 결과:**
- vitest: 모든 web 테스트 파일 PASS. 특히:
  - `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx` 12 케이스 PASS (기존 6 + 신규 6 — B-2-RESIDUAL Option C 포함)
  - `apps/web/components/admin/__tests__/svg-preview.test.tsx` 4 케이스 PASS
  - `apps/web/hooks/__tests__/use-is-mobile.test.ts` 4 케이스 PASS (B-4 getServerSnapshot 포함)
  - `apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts` 5 케이스 PASS (W-2 helper)
  - 기타 web 테스트 파일 회귀 0
- typecheck: `Found 0 errors` 또는 exit 0 (출력 없음)
- lint: warning 0 + error 0 (Phase 12 변경 코드만 — 기존 파일에 잔존하던 warning은 본 phase 책임 아님 — 단, error는 0)

**실패 시 처리:**
- vitest 실패 → 어느 케이스 FAIL인지 식별 → Plan 12-00/12-01/12-02/12-03 중 책임 plan으로 revision 요청 (gap closure 모드 진입 후보)
- typecheck 실패 → 변경 파일 grep으로 식별 → 해당 plan revision
- lint error → 자동 수정 가능 시 `pnpm --filter @grapit/web lint --fix` 시도, 그래도 실패 시 수동 수정

**Step B: 12-VALIDATION.md frontmatter 갱신 (I-2)**

위 자동 회귀가 모두 GREEN인 경우에만 진행. 12-VALIDATION.md frontmatter를 다음과 같이 갱신:

기존:
```yaml
---
phase: 12
slug: ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---
```

변경 후:
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

(`signed_off` 필드는 Task 2 manual QA gate가 PASS된 시점에 추가하는 것이 정확하지만, 본 task에서는 frontmatter 형식 갱신만 — `status: approved`와 `signed_off`는 Task 2 후 최종 갱신.)

본 task에서는 다음만 갱신:
- `nyquist_compliant: false → true` (Wave 0 + 모든 자동 검증 GREEN 증거)
- `wave_0_complete: false → true` (Wave 0 신규 테스트 파일 4개 모두 vitest 실행 성공)

**선택: web e2e (Playwright)는 본 phase 범위 밖.** Phase 12는 시각/UX 변경만 — 기존 E2E flow는 회귀 위험 낮음. 단, `/admin/dashboard` 카드 시각 회귀가 있을 수 있어 manual QA(Task 2)에서 시각 확인.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web test --run 2>&1 | tail -10 && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && grep -q "nyquist_compliant: true" .planning/phases/12-ux/12-VALIDATION.md && grep -q "wave_0_complete: true" .planning/phases/12-ux/12-VALIDATION.md</automated>
  </verify>
  <acceptance_criteria>
    - vitest exit 0:
      - `pnpm --filter @grapit/web test --run` 의 exit code 0
      - 출력에 "FAIL" 또는 "✗" 0건
      - 출력에 "Test Files  N passed" + "Tests  M passed" 형태로 요약 라인 존재
    - typecheck exit 0:
      - `pnpm --filter @grapit/web typecheck` exit code 0
    - lint exit 0:
      - `pnpm --filter @grapit/web lint` exit code 0
      - error count 0
    - **I-2: 12-VALIDATION.md frontmatter 갱신 검증:**
      - `grep -q "nyquist_compliant: true" .planning/phases/12-ux/12-VALIDATION.md`
      - `grep -q "wave_0_complete: true" .planning/phases/12-ux/12-VALIDATION.md`
    - 결과 캡처: 본 task SUMMARY 또는 12-04-SUMMARY.md에 위 3개 명령 출력 tail 인용 (≥ 5줄씩)
  </acceptance_criteria>
  <done>
web vitest 풀 + typecheck + lint 모두 GREEN. 출력 캡처 완료. 회귀 0건 확인. 12-VALIDATION.md frontmatter `nyquist_compliant: true`, `wave_0_complete: true` 갱신 (I-2). Wave 4 Task 2 (manual QA gate)로 진행 가능 상태.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Manual QA Gate — 시각/실디바이스/OS 설정 검증 (B-1/B-4/W-1/W-3 검증 항목 포함)</name>
  <files>(no file changes — manual verification gate)</files>
  <action>
사용자가 dev server를 실행하고, 아래 `<how-to-verify>` 섹션의 8개 검증 시나리오를 직접 수행한다.
Claude는 이 task에서 자동 작업을 수행하지 않고, 사용자가 "approved" 또는 구체적 FAIL 항목을 응답할 때까지 대기.
FAIL 발생 시 책임 plan(12-01/12-02/12-03 중 하나)으로 revision 모드 진입 후보가 된다.
  </action>
  <verify>
    <automated>echo "manual checkpoint — awaiting user sign-off"</automated>
  </verify>
  <done>사용자가 8개 검증 항목을 모두 PASS로 확인하고 "approved" 응답.</done>
  <what-built>
    Plan 12-01/12-02/12-03 완료 후 자동 검증 불가능한 다음 시각/접근성 행위:
    1. globals.css 토큰(--shadow-sm/md, --radius-sm/md/lg/xl) 추가로 shadcn 컴포넌트(`/admin/dashboard` 카드, 홈 button/badge 등) elevation·radius modernize (DevTools Computed box-shadow 값 일치 검증 포함 — W-3)
    2. 홈(`/`) 섹션 간 수직 리듬 mt-12 → mt-10 toned
    3. seat-legend dot + 등급명 + 가격 표시 (UX-03 D-10 검증만)
    4. 좌석 클릭 시 rect fill이 tier→primary로 부드럽게 fade (150ms — B-2-RESIDUAL Option C useEffect 검증 핵심) + 체크마크 fade-in 부드럽게 (150ms) + 좌석 해제 시 rect fill이 primary→tier로 fade + 체크마크 fade-out 부드럽게 (150ms 후 DOM 제거 — UI-SPEC §Interaction + B-1) + 다른 좌석 transition:none 유지
    5. 데스크톱 좌석맵에서 미니맵 좌상단 표시 + zoom/pan 시 viewport rect 동기 갱신
    6. 모바일 실디바이스에서 좌석 터치 폭 ≥ 44px (WCAG 2.5.5) — 인접 좌석 오탭 0회
    7. `prefers-reduced-motion: reduce` OS 설정 시 체크마크 fade-in/fade-out 모두 즉시 (transition 비활성)
    8. 다른 탭/세션에서 좌석 잠금 시 자기 화면에서 즉시 회색 전환 (D-13 broadcast 즉시 플립)
    9. **B-4: dev server 첫 진입 시 브라우저 콘솔 hydration warning 0건 (SSR fallback 정합성 증명)**
  </what-built>
  <how-to-verify>
**준비:**
1. dev server 실행:
   ```bash
   cd /Users/sangwopark19/icons/grapit
   pnpm dev
   ```
2. 브라우저 두 개 준비 (한쪽은 admin 계정, 한쪽은 일반 계정)
3. 모바일 실디바이스 1대 준비 (iOS Safari 또는 Android Chrome) — 동일 ngrok/local network로 접근

──────

**검증 1 (UX-01) — 디자인 토큰 시각 modernize + W-3 DevTools Computed 검증:**
1. `http://localhost:3000/admin/dashboard` 접속 (admin 로그인 필요)
2. 카드 컴포넌트의 shadow가 부드럽고 (`shadow-sm` ~ `shadow-md` 강도, 과한 그림자 없음), border-radius가 일관(8~12px) 한지 확인
3. **W-3 DevTools Computed 검증**: 카드 element 우클릭 → 검사 → Inspector → Computed 탭 → `box-shadow` 값이 다음 중 하나와 정확히 일치해야 함:
   - `shadow-sm` 적용 카드: `rgba(0, 0, 0, 0.05) 0px 1px 2px 0px`
   - `shadow-md` 적용 카드: `rgba(0, 0, 0, 0.08) 0px 4px 12px -2px`
   - 추가로 `border-radius` Computed 값이 8/10/12px 중 하나로 일관성 확인
4. `http://localhost:3000/` 접속, 홈 섹션 간 spacing이 mt-10 (40px)로 toned 됐는지 시각 확인
5. 비교를 원하면 git stash 후 동일 페이지 비교 — 단, dev server 재시작 필요

**기대 결과:** 카드 elevation 개선 + radius 일관성 향상 + 홈 spacing 자연스러움. DevTools Computed box-shadow 값이 토큰 정의와 정확히 일치 (W-3).

──────

**검증 2 (UX-03 D-10) — seat-legend:**
1. `http://localhost:3000/booking/{performanceId}` 접속 (시드 데이터 또는 admin 생성 공연)
2. 좌석맵 우측 또는 하단의 seat-legend 영역에서 등급별 dot(색) + 등급명 + "N,NNN원" 표시 확인

**기대 결과:** 기존 구현(D-10) 그대로 보임. Phase 12에서 변경 없음 — 시각 회귀만 확인.

──────

**검증 3 (UX-04 + B-1 + B-2-RESIDUAL Option C) — rect fill transition + 체크마크 fade-in/fade-out + transition 정책 (UI-SPEC §Interaction 선택·해제 둘 다 fade):**
1. 좌석맵에서 좌석 1개 클릭 → **rect fill이 tier color → primary(#6C3CE0)로 부드럽게 fade (150ms)**가 사용자에게 시각적으로 보이는지 확인 (B-2-RESIDUAL Option C 검증 핵심 — useEffect가 동일 element의 fill을 변경 → CSS transition 정상 발화)
2. 동시에 체크마크가 즉시 보이지 않고 ~150ms 동안 부드럽게 fade-in 되는지 확인 (opacity 0→1)
3. **B-1 카피 교체**: 같은 좌석 다시 클릭 (해제) → rect fill이 primary → tier color로 부드럽게 fade (150ms) + 체크마크가 150ms fade-out 후 제거됨. `prefers-reduced-motion: reduce` 시만 즉시.
4. 여러 좌석 동시 클릭 → 각 좌석마다 fill transition + fade-in 부드럽게
5. 여러 좌석 동시 해제 → 각 좌석마다 fill transition + fade-out 부드럽게 (150ms 후 DOM에서 사라짐)
6. (선택) DevTools Elements 패널에서 해제 직후 ~150ms 동안 체크마크 `<text>` element가 `data-fading-out="true"` 속성을 가지고 존재하다가 사라지는 것을 시각 확인
7. (선택) DevTools Elements 패널에서 선택 좌석의 rect element가 inline style에 `transition: fill 150ms ease-out, stroke 150ms ease-out;` 가지는 것을 확인 (useEffect가 부여)

**기대 결과:** 선택·해제 둘 다 rect fill + 체크마크 fade 부드럽게, 비선택 좌석/잠긴 좌석 즉시 플립 (산만하지 않음). UI-SPEC §Interaction §L240~243 충족.

**FAIL 시 (B-2-RESIDUAL Option C):** rect fill이 즉시 변하고 transition 없이 보이면 → Plan 12-03 Task 3 useEffect 누락 또는 deps 누락 확인. 체크마크는 fade되는데 rect fill만 즉시 변하면 → useEffect의 selectedSeatIds/pendingRemovals deps 또는 containerRef.current.querySelector 실패 확인.

──────

**검증 4 (UX-05) — 미니맵 데스크톱 표시 + viewport rect 동기:**
1. 데스크톱(`width >= 768px`)에서 좌석맵 진입 → 좌상단에 ~120px width의 미니맵 표시 확인
2. 좌석맵을 zoom in (마우스 휠 위 또는 `+` 버튼) → 미니맵 안 viewport rect (Brand Purple #6C3CE0 stroke)가 작아지면서 현재 보이는 영역을 표시
3. 좌석맵을 드래그(pan) → viewport rect 위치가 실시간으로 따라옴
4. 미니맵 자체에는 좌석 색상(tier)도 축소되어 표시됨

**기대 결과:** 미니맵 viewport rect가 zoom/pan과 동기. flicker/lag 없음.

──────

**검증 5 (UX-06 D-17) — 모바일 자동 1.4x 줌 + 44px 터치 타겟:**
1. 모바일 디바이스(iOS Safari 또는 Android Chrome)에서 ngrok/local network로 좌석맵 진입
2. **첫 paint 시점에 좌석이 32px가 아닌 44.8px (≈ 32 × 1.4)로 보이는지** 시각 확인
3. 좌석을 손가락으로 탭 → 정확히 의도한 좌석이 선택되는지 (인접 좌석 오탭 0회)
4. 데스크톱에서는 동일 좌석맵이 32px로 보임 (initialScale=1)

**기대 결과:** 모바일 좌석 터치 정확도 100%. 인접 오탭 발생 시 → 회귀 신고 → Plan 12-03 revision.

──────

**검증 6 (UX-04 reduced-motion) — OS 설정 의존 (선택·해제 둘 다 즉시):**
1. macOS: System Settings → Accessibility → Display → "Reduce motion" 켜기
   - 또는 Chrome DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce"
2. 좌석맵에서 좌석 클릭 → 체크마크가 fade-in 없이 **즉시** 표시되는지 확인
3. 같은 좌석 재클릭 (해제) → 체크마크가 fade-out 없이 **즉시** 사라지는지 확인 (B-1: reduced-motion 시 fade-out도 0.01ms로 즉시)

**기대 결과:** prefers-reduced-motion 활성화 시 체크마크 선택·해제 모두 즉시 (animation-duration: 0.01ms). fade 애니메이션 안 보임.

──────

**검증 7 (D-13 broadcast 즉시 플립) — 다중 탭/세션:**
1. 브라우저 탭 A에서 좌석맵 진입
2. 다른 브라우저 (또는 incognito 탭 B)에서 동일 좌석맵 + 동일 공연 진입 + 좌석 1개 선택 (잠금)
3. 탭 A에서 그 좌석이 **fade 없이** 즉시 회색으로 전환되는지 확인

**기대 결과:** broadcast 좌석은 transition 없이 즉시 회색 (D-13 회귀 방지).

──────

**검증 8 (B-4) — dev server 첫 진입 시 Hydration warning 0건:**
1. dev server를 깨끗하게 재시작 (`pnpm dev` Ctrl+C 후 재실행)
2. 브라우저 콘솔 열기 (F12 → Console 탭)
3. `http://localhost:3000/booking/{performanceId}` 첫 진입
4. 콘솔에 다음 경고가 **0건** 인지 확인:
   - `Hydration failed because the initial UI does not match what was rendered on the server`
   - `Warning: Text content does not match server-rendered HTML`
   - `Warning: Expected server HTML to contain a matching ...`
   - 기타 React hydration mismatch 관련 warning
5. 모바일 viewport (Chrome DevTools Toggle device toolbar — iPhone 등)에서도 동일 검증
6. **W-1 가이드 (hydration warning 발견 시 추적):** `git diff apps/web/hooks/use-is-mobile.ts apps/web/components/booking/seat-map-viewer.tsx` 명령으로 SSR/CSR 경계에 영향을 준 변경 추적 — B-4 unit test (`use-is-mobile.test.ts`)는 통과해도 SSR 경로에 *다른 변경이 추가*된 것임. (Playwright/Cypress 자동화는 Phase 12 범위 밖 → defer.)

**기대 결과:** Hydration warning 0건. SSR fallback (`getServerSnapshot returns false`)이 hydration 시점 desktop initialScale=1과 정합 → mobile에서도 hydrate 후 useIsMobile=true로 전환 + key 토글로 재마운트 → 깨끗한 hydration. 이 검증은 unit test의 `getServerSnapshot()` 검증(B-4 Wave 0)과 이중 가드.

**FAIL 시:** Plan 12-02 use-is-mobile.ts revision (getServerSnapshot 반환값 확인) 또는 Plan 12-03 viewer revision (TransformWrapper key 토글 누락 확인).

──────

**결과 기록 (선택):**
`.planning/phases/12-ux/12-04-MANUAL-QA-CHECKLIST.md` 파일 생성 후 각 검증 항목 PASS/FAIL/NOTE 기록.
스크린샷 첨부 시 `.planning/phases/12-ux/screenshots/` 디렉토리에 저장.

**FAIL 처리:**
- UX-01 시각 회귀 → Plan 12-01 revision (토큰 값 조정)
- W-3 DevTools box-shadow 값 불일치 → Plan 12-01 revision (`--shadow-sm`/`--shadow-md` 토큰 값 검증)
- **UX-04 rect fill transition 안 보임 (즉시 색 변경)** → Plan 12-03 Task 3 useEffect 누락/deps 누락 확인 (B-2-RESIDUAL Option C 핵심)
- UX-04 체크마크 fade-in 안 보임 → Plan 12-01 ([data-seat-checkmark] selector 누락) 또는 Plan 12-03 Task 2 (체크마크 attr 추가 누락) 확인
- B-1 fade-out 안 보임 (즉시 사라짐) → Plan 12-01 (`@keyframes seat-checkmark-fade-out` 또는 `[data-fading-out="true"]` selector 누락) 또는 Plan 12-03 Task 2 (pendingRemovals 메커니즘 누락) 확인
- UX-05 미니맵 viewport rect 동기 안 됨 → react-zoom-pan-pinch 버전 확인 + Plan 12-03 Task 1 MiniMap props 확인
- UX-06 모바일 32px → useIsMobile hook 동작 확인 + TransformWrapper key 토글 확인 (Plan 12-02/12-03 revision)
- reduced-motion 무시 → globals.css `@media (prefers-reduced-motion: reduce)` 정의 확인 (Plan 12-01 revision — fade-in + fade-out 둘 다 0.01ms)
- D-13 broadcast fade → seat-map-viewer.tsx의 locked/sold 분기에 transition:none 유지 확인 (Plan 12-03 Task 2 revision)
- **B-4 Hydration warning 발생** → use-is-mobile.ts `getServerSnapshot()` 반환값 확인 (false 여야 함) + viewer SSR HTML이 desktop 형태로 생성되는지 확인 (Plan 12-02/12-03 revision). 추가로 위 검증 8 step 6의 git diff 가이드로 SSR/CSR 경계 변경 식별.
  </how-to-verify>
  <resume-signal>
"approved" 입력 시 → Phase 12 종료 + 12-VALIDATION.md Approval signed-off (`status: approved` 추가) + 본 plan 완료. 또는 구체 FAIL 항목 기록 시 → 해당 plan revision 모드로 진입.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (없음) | Wave 4는 자동 검증 + 수동 QA만 — 새 코드/보안 표면 0. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| (해당 없음) | — | — | — | Wave 4는 검증 단계 — 새 위협 없음. T-12-01 (admin SVG 입력 검증)은 Plan 12-02에서 mitigate 완료, 본 plan에서 사용자 시각 검증으로 추가 확인. |
</threat_model>

<verification>
- [ ] `pnpm --filter @grapit/web test --run` GREEN (모든 web suite, 회귀 0)
- [ ] `pnpm --filter @grapit/web typecheck` GREEN
- [ ] `pnpm --filter @grapit/web lint` GREEN
- [ ] **I-2: 12-VALIDATION.md frontmatter `nyquist_compliant: true`, `wave_0_complete: true` 갱신**
- [ ] 사용자 manual QA 8개 검증 항목 모두 PASS (또는 FAIL 시 책임 plan revision) — B-1 fade-out, B-2-RESIDUAL Option C rect fill transition, W-1 git diff 가이드, W-3 DevTools, B-4 hydration warning 포함
- [ ] 12-VALIDATION.md `Approval`이 signed-off로 전환
</verification>

<success_criteria>
- 자동: vitest + typecheck + lint 3개 명령 모두 exit 0 + 12-VALIDATION.md frontmatter 갱신
- 수동: 사용자가 "approved" 응답 → 8개 manual QA 항목 모두 PASS 확인
- 12-VALIDATION.md `Validation Sign-Off` 6개 항목 모두 체크 (UX-01~UX-06 + 회귀)
- Phase 12 ROADMAP entry: `[x] Phase 12: UX 현대화 — completed YYYY-MM-DD` (별도 명령 — `/gsd-verify-work` 또는 phase 종료 시)
</success_criteria>

<output>
After completion, create `.planning/phases/12-ux/12-04-SUMMARY.md`:
- 자동 검증 결과 (vitest/typecheck/lint 출력 tail)
- 12-VALIDATION.md frontmatter 갱신 증거 (I-2)
- Manual QA 결과 (8개 항목 PASS/FAIL — B-1/B-2-RESIDUAL/W-1/W-3/B-4 포함)
- (선택) `.planning/phases/12-ux/12-04-MANUAL-QA-CHECKLIST.md` 작성
- 12-VALIDATION.md Approval status 업데이트 (`pending` → `signed-off`)
- Phase 12 종료 준비 완료 신호
</output>
</content>
