---
status: resolved
trigger: "pnpm dev 실행 시 @grapit/api에서 TypeScript declaration emit 관련 에러 4개 발생"
created: 2026-03-30T00:00:00Z
updated: 2026-03-30T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - all 4 declaration emit errors resolved
test: npx tsc --noEmit --project apps/api/tsconfig.json
expecting: zero errors
next_action: awaiting human verification via pnpm dev

## Symptoms

expected: pnpm dev 실행 시 TypeScript 에러 없이 정상 동작
actual: TSC가 4개의 에러를 보고함 (런타임은 정상 동작)
errors:
1. TS4053 in local.strategy.ts:15 - Return type of public method validate uses ValidatedUser from auth.service but cannot be named
2. TS2742 in naver.strategy.ts:14 - Inferred type of NaverStrategy cannot be named without reference to @types/passport-oauth2
3. TS4053 in sms.controller.ts:32 - Return type of public method sendCode uses SendResult from sms.service but cannot be named
4. TS4053 in sms.controller.ts:41 - Return type of public method verifyCode uses VerifyResult from sms.service but cannot be named
reproduction: Run pnpm dev from monorepo root
started: Since these files were written

## Eliminated

(none)

## Evidence

- timestamp: 2026-03-30T00:01:00Z
  checked: tsconfig.base.json
  found: declaration: true and declarationMap: true are set -- TypeScript must emit .d.ts files for all public APIs
  implication: All exported class methods must have return types that can be referenced in declaration files

- timestamp: 2026-03-30T00:01:00Z
  checked: auth.service.ts
  found: ValidatedUser interface is defined as a private (non-exported) interface at line 24
  implication: local.strategy.ts validate() returns ValidatedUser via authService.validateUser() but TS can't name it in .d.ts

- timestamp: 2026-03-30T00:01:00Z
  checked: sms.service.ts
  found: SendResult (line 5) and VerifyResult (line 10) are private interfaces
  implication: sms.controller.ts methods return these types but TS can't name them in .d.ts

- timestamp: 2026-03-30T00:01:00Z
  checked: node_modules/@types/passport-oauth2
  found: Package NOT installed (checked both apps/api/node_modules and root node_modules)
  implication: NaverStrategy extends PassportStrategy which depends on passport-oauth2 types; TS can't resolve the class type for declaration

## Resolution

root_cause: tsconfig.base.json enables declaration emit (declaration: true). Three interface types (ValidatedUser, SendResult, VerifyResult) are defined as module-private in their respective service files but are used as return types by public methods in other files. Additionally, @types/passport-oauth2 is missing, so the NaverStrategy class type can't be fully resolved for declaration emit.
fix: (1) Export ValidatedUser from auth.service.ts (2) Export SendResult and VerifyResult from sms.service.ts (3) Add explicit return type annotations on local.strategy.ts validate(), sms.controller.ts sendCode() and verifyCode() (4) Add explicit type annotation to NaverStrategy class to avoid passport-oauth2 dependency
verification: tsc --noEmit passes with zero errors (was 4 errors before fix)
files_changed:
  - apps/api/src/modules/auth/auth.service.ts
  - apps/api/src/modules/auth/strategies/local.strategy.ts
  - apps/api/src/modules/auth/strategies/naver.strategy.ts
  - apps/api/src/modules/sms/sms.service.ts
  - apps/api/src/modules/sms/sms.controller.ts
