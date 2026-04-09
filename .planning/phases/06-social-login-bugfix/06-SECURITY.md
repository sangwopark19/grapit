---
phase: 06
slug: social-login-bugfix
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-09
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| OAuth Provider -> Backend Callback | 외부 소셜 provider가 callback URL로 인증 결과 전달 | OAuth authorization code, user profile (email, name, providerId) |
| Backend -> Frontend Redirect | 백엔드가 에러 코드를 query parameter로 프론트엔드에 전달 | Generic error codes (oauth_failed, server_error 등), refresh token (httpOnly cookie) |
| Frontend -> Backend API | 프론트엔드가 refresh token cookie로 인증 요청 | Refresh token (httpOnly, secure, sameSite=lax) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-06-01 | Spoofing | OAuth callbackURL | mitigate | callbackURL 기본값에 `/social/` 세그먼트 포함, 환경변수 override 가능. 3개 strategy 모두 컨트롤러 라우트와 일치 확인 | closed |
| T-06-02 | Tampering | CSRF via OAuth | accept | Passport.js 내장 state parameter로 CSRF 방어. 추가 구현 불필요 | closed |
| T-06-03 | Information Disclosure | Refresh token cookie | mitigate | `httpOnly: true`, `secure: isProduction`, `sameSite: 'lax'`. OAuth redirect chain 호환성을 위해 strict→lax 변경은 ASVS L1 허용 범위 | closed |
| T-06-04 | Elevation of Privilege | Open redirect after OAuth | mitigate | guard + controller 모두 `FRONTEND_URL` 환경변수를 configService에서 읽어 redirect 대상 고정. 임의 URL redirect 불가 | closed |
| T-06-05 | Information Disclosure | Error code in query param | accept | Generic 에러 코드만 사용 (oauth_failed, server_error 등). Provider 내부 에러 상세는 서버 로그에만 기록 | closed |
| T-06-06 | Spoofing | OAuth Redirect URI in provider console | mitigate | 카카오/네이버/구글 개발자 콘솔에서 Redirect URI 수동 확인 완료 (2026-04-09) | closed |
| T-06-07 | Information Disclosure | E2E test credentials | accept | 테스트 계정은 개발용, 프로덕션 데이터 접근 불가. `.env`에 저장되어 `.gitignore` 대상 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-02 | Passport.js의 OAuth state parameter가 CSRF를 방어함. 별도 CSRF 토큰 불필요 | Developer | 2026-04-09 |
| AR-06-02 | T-06-05 | Query parameter에 노출되는 에러 코드는 generic 분류만 포함. 서버 상세 에러는 로그에만 기록 | Developer | 2026-04-09 |
| AR-06-03 | T-06-07 | E2E 테스트 계정은 개발 환경 전용. .env gitignored. 프로덕션 데이터 접근 경로 없음 | Developer | 2026-04-09 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-09 | 7 | 7 | 0 | gsd-secure-phase |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-09
