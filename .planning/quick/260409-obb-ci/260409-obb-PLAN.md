---
phase: quick
plan: 260409-obb
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/vitest.config.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Vitest does not attempt to run Playwright e2e tests"
    - "CI pipeline passes without e2e test failures from Vitest"
    - "Existing Vitest unit/component tests still run correctly"
  artifacts:
    - path: "apps/web/vitest.config.ts"
      provides: "Vitest config with e2e exclusion"
      contains: "exclude"
  key_links: []
---

<objective>
Fix CI pipeline failure caused by Vitest picking up Playwright e2e test files.

Purpose: `apps/web/e2e/social-login.spec.ts` imports from `@playwright/test` but Vitest
scans all `.spec.ts` files by default, causing type and context conflicts. Adding an
explicit `exclude` for the `e2e/` directory prevents Vitest from touching Playwright files.

Output: Updated `apps/web/vitest.config.ts` with `exclude` configuration.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/vitest.config.ts
@apps/web/e2e/social-login.spec.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add e2e exclusion to Vitest config</name>
  <files>apps/web/vitest.config.ts</files>
  <action>
In `apps/web/vitest.config.ts`, add an `exclude` array to the `test` section:

```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: [],
  exclude: ['e2e/**', 'node_modules/**'],
},
```

The `node_modules/**` entry preserves the Vitest default exclusion that gets overridden
when a custom `exclude` is provided. The `e2e/**` entry prevents Vitest from scanning
the Playwright test directory.

Do NOT change any other config options. Do NOT modify the resolve aliases or plugins.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web exec vitest run --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>
- `vitest run` in apps/web completes without attempting to load `e2e/social-login.spec.ts`
- No Playwright import errors in the Vitest output
- Any existing unit/component tests still pass
  </done>
</task>

</tasks>

<verification>
1. `pnpm --filter @grapit/web exec vitest run` passes without e2e file errors
2. Output does NOT contain `e2e/social-login.spec.ts` in the test file list
3. If any existing unit tests exist, they still pass
</verification>

<success_criteria>
- Vitest config explicitly excludes `e2e/**` directory
- CI pipeline no longer fails due to Playwright/Vitest conflict
- Zero regression on existing tests
</success_criteria>

<output>
After completion, create `.planning/quick/260409-obb-ci/260409-obb-SUMMARY.md`
</output>
