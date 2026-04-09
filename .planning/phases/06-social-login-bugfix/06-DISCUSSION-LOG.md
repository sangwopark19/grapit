# Phase 6: 소셜 로그인 버그 수정 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 06-소셜 로그인 버그 수정
**Areas discussed:** 수정 범위, 테스트 검증, 에러 UX

---

## 수정 범위

| Option | Description | Selected |
|--------|-------------|----------|
| 최소 버그 수정만 | 재로그인 실패 원인만 진단하고 최소한의 코드 변경으로 수정. 안정성 우선. | |
| 버그 수정 + 소셜 플로우 개선 | 버그 수정과 함께 에러 핸들링 강화, 디버그 로깅 추가, 엣지 케이스 처리까지 함께 개선 | ✓ |
| 전면 리팩토링 | 소셜 로그인 플로우 전체를 재설계 | |

**User's choice:** 버그 수정 + 소셜 플로우 개선

### 개선 범위 상세

| Option | Description | Selected |
|--------|-------------|----------|
| 디버그 로깅 추가 | 각 소셜 로그인 단계에 구조화된 로그 추가 | |
| 로깅 + 에러 핸들링 강화 | 로깅에 더해 provider 응답 없음, 토큰 만료 등 엣지 케이스별 에러 처리 추가 | |
| 로깅 + 에러 + callback URL 검증 | 위 두 가지에 더해 세 provider의 callbackURL 설정이 실제 컨트롤러 라우트와 일치하는지 검증/수정 | ✓ |

**User's choice:** 로깅 + 에러 + callback URL 검증

---

## 테스트 검증

| Option | Description | Selected |
|--------|-------------|----------|
| 유닛 테스트 + 수동 확인 | findOrCreateSocialUser 로직을 mock DB로 유닛 테스트하고, 실제 3개 프로바이더는 배포 후 수동으로 확인 | |
| 유닛 테스트만 | mock으로 전체 플로우 테스트. 빠르지만 실제 OAuth 리다이렉트/쿠키 문제는 못 잡음. | |
| E2E 테스트 자동화 | Playwright로 세 프로바이더 실제 OAuth 플로우 E2E 테스트 | ✓ |

**User's choice:** E2E 테스트 자동화

### E2E 범위

| Option | Description | Selected |
|--------|-------------|----------|
| 재로그인 플로우만 | 핵심 버그인 '로그아웃 후 재로그인' 시나리오만 E2E로 검증 | |
| 전체 소셜 플로우 | 최초 소셜 회원가입 → 로그아웃 → 재로그인 전체를 E2E로 | ✓ |
| 유닛 + 수동 E2E 병행 | 로직은 유닛으로, 실제 OAuth 리다이렉트는 수동 E2E 체크리스트로 별도 관리 | |

**User's choice:** 전체 소셜 플로우

---

## 에러 UX

| Option | Description | Selected |
|--------|-------------|----------|
| 원인별 구체적 메시지 | 토큰 만료, provider 응답 없음, 이미 연결된 계정 등 원인별로 다른 안내 메시지 표시 + 재시도 버튼 | ✓ |
| 토스트 개선만 | 현재 '로그인에 실패했습니다' 토스트를 조금 더 구체적으로 변경. 플로우 변경 없이 메시지만 수정. | |
| 전용 에러 페이지 | 로그인 실패 시 전용 에러 페이지로 이동. 원인 설명, 재시도, 고객센터 안내 등 포함. | |

**User's choice:** 원인별 구체적 메시지

---

## Claude's Discretion

- 디버그 로깅의 구체적 포맷과 레벨
- E2E 테스트 헬퍼 구조
- 에러 코드 체계

## Deferred Ideas

None
