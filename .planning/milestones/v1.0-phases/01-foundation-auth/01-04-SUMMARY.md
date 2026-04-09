---
phase: 01-foundation-auth
plan: 04
subsystem: auth, sms
tags: [social-oauth, kakao, naver, google, sms, twilio, passport]
dependency_graph:
  requires: [01-02]
  provides: [social-login, sms-verification, needs-registration-flow]
  affects: [01-05]
tech_stack:
  added: [passport-kakao, passport-naver-v2, passport-google-oauth20, twilio]
  patterns: [passport-strategy-mixin, dev-mock-mode, e164-phone-normalization, social-registration-token]
key_files:
  created:
    - apps/api/src/modules/auth/strategies/kakao.strategy.ts
    - apps/api/src/modules/auth/strategies/naver.strategy.ts
    - apps/api/src/modules/auth/strategies/google.strategy.ts
    - apps/api/src/modules/auth/strategies/kakao.strategy.spec.ts
    - apps/api/src/modules/auth/strategies/naver.strategy.spec.ts
    - apps/api/src/modules/auth/strategies/google.strategy.spec.ts
    - apps/api/src/modules/auth/guards/social-auth.guard.ts
    - apps/api/src/modules/auth/interfaces/social-profile.interface.ts
    - apps/api/src/modules/auth/dto/social-register.dto.ts
    - apps/api/src/modules/sms/sms.service.ts
    - apps/api/src/modules/sms/sms.controller.ts
    - apps/api/src/modules/sms/sms.module.ts
    - apps/api/src/modules/sms/sms.service.spec.ts
  modified:
    - apps/api/src/modules/auth/auth.service.ts
    - apps/api/src/modules/auth/auth.controller.ts
    - apps/api/src/modules/auth/auth.module.ts
    - apps/api/src/modules/auth/auth.service.spec.ts
    - apps/api/src/modules/user/user.repository.ts
    - apps/api/src/app.module.ts
    - apps/api/package.json
decisions:
  - Social OAuth uses registrationToken flow for new users (D-04 compliance: social login requires terms + additional info)
  - Twilio Verify API for SMS with dev mock mode (000000 universal code) for development without credentials
  - E.164 phone normalization strips all non-digit chars and prepends +82 for Korean numbers
metrics:
  duration: 10min
  completed: "2026-03-27"
---

# Phase 01 Plan 04: Social OAuth + SMS Verification Summary

Kakao/Naver/Google OAuth strategies with needs_registration flow for new social users, plus Twilio Verify SMS verification with dev mock fallback

## What Was Done

### Task 1: Social OAuth Strategies + Auth Service Social Flow

**TDD cycle completed** (RED -> GREEN):

- Created 3 passport strategies (KakaoStrategy, NaverStrategy, GoogleStrategy) each using PassportStrategy mixin with provider-specific profile extraction
- Added `findOrCreateSocialUser()` to AuthService: looks up social_accounts table, returns `authenticated` with JWT for existing users or `needs_registration` with a 30-minute registrationToken for new users
- Added `completeSocialRegistration()` to AuthService: verifies registrationToken, creates user (passwordHash=null) + social_account + terms_agreement, supports account linking when social email matches existing user
- Added social auth controller endpoints: GET social/:provider (OAuth redirect), GET social/:provider/callback (handle result + redirect to frontend), POST social/complete-registration
- Created per-provider auth guards (KakaoAuthGuard, NaverAuthGuard, GoogleAuthGuard)
- Created SocialProfile interface and SocialRegisterBody DTO with zod validation
- Updated UserRepository.NewUser to accept `passwordHash: string | null` for social-only accounts
- Registered all 3 strategies in AuthModule

### Task 2: SMS Verification Module

**TDD cycle completed** (RED -> GREEN):

- Created SmsService with Twilio Verify API integration (sendVerificationCode, verifyCode)
- Dev mock mode: when TWILIO_ACCOUNT_SID is not set, logs code as 000000 and accepts it as universal valid code
- Phone number normalization to E.164 format: `01012345678` -> `+821012345678`
- Created SmsController with POST /api/v1/sms/send-code and POST /api/v1/sms/verify-code endpoints
- Zod validation for phone (Korean mobile regex) and code (6 digits)
- Registered SmsModule in AppModule

## Commits

| Hash | Message |
|------|---------|
| `52aaf6d` | test(01-04): add failing tests for social OAuth strategies and auth service social flow |
| `4041d29` | feat(01-04): implement social OAuth strategies and social auth flow |
| `6a03081` | test(01-04): add failing tests for SMS verification service |
| `42abcc6` | feat(01-04): implement SMS verification module with Twilio Verify and dev mock |

## Test Results

```
Test Files  5 passed (5)
Tests       30 passed (30)
Duration    582ms
```

- `auth.service.spec.ts`: 18 tests (13 existing + 5 new social auth)
- `kakao.strategy.spec.ts`: 2 tests (profile extraction + fallback)
- `naver.strategy.spec.ts`: 2 tests (profile extraction + missing email)
- `google.strategy.spec.ts`: 2 tests (profile extraction + missing email)
- `sms.service.spec.ts`: 6 tests (3 production + 3 dev mode)

## Decisions Made

1. **registrationToken flow for social login** -- Per D-04, social login also requires terms agreement + additional info (name, gender, phone, etc.). New social users get a 30-minute JWT registrationToken; frontend collects remaining info and calls POST /social/complete-registration
2. **Account linking on email match** -- When a social user's email matches an existing user, completeSocialRegistration links the social account to the existing user instead of creating a duplicate
3. **Twilio dev mock mode** -- Development works without Twilio credentials; SmsService detects missing TWILIO_ACCOUNT_SID and uses 000000 as universal valid code
4. **E.164 normalization** -- All phone numbers normalized by stripping non-digits and prepending +82 for Korean numbers starting with 0

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all functionality is wired and operational (SMS uses Twilio in production, dev mock in development).

## Auth Gate Notes

Social OAuth requires external API credentials (Kakao/Naver/Google client IDs + Twilio). The `user_setup` section in the plan documents exact steps for obtaining these credentials. The implementation works without these credentials in development mode (social strategies will error on missing config, SMS uses dev mock).

## Self-Check: PASSED

- All 13 created files verified present on disk
- All 4 commits verified in git history (52aaf6d, 4041d29, 6a03081, 42abcc6)
- All 30 tests pass across 5 test files
