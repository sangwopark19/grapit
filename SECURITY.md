# SECURITY.md

**Phase:** 05 — polish-launch
**ASVS Level:** 1
**Audited:** 2026-04-08
**block_on:** critical

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-05-01 | Information Disclosure | accept | CLOSED | MobileTabBar 네비게이션 링크만 포함, 민감 데이터 없음 |
| T-05-02 | Spoofing | accept | CLOSED | aria-current CSS 표시 용도만, 인증/인가 로직 없음 |
| T-05-03 | Information Disclosure | accept | CLOSED | 스켈레톤은 정적 placeholder만 렌더링, 사용자 데이터 미포함 |
| T-05-04 | Information Disclosure | mitigate | CLOSED | apps/web/lib/api-client.ts:109-125 — STATUS_MESSAGES lookup, server `message` 필드만 사용, stack/query 필드 무시 확인 |
| T-05-05 | Information Disclosure | mitigate | CLOSED | apps/web/app/error.tsx:27-30 — `error.digest` 미노출(global-error.tsx에서만 digest 표시), statusCode는 `ERR-{statusCode}` 형태로만 노출 |
| T-05-06 | Denial of Service | accept | CLOSED | NetworkBanner reload는 사용자가 직접 클릭해야 실행됨, 자동 재시도 없음 |
| T-05-07 | Information Disclosure | mitigate | CLOSED | apps/web/Dockerfile, apps/api/Dockerfile — 2-stage 멀티스테이지 빌드(builder→runner). .dockerignore:4-5 — `.env` 및 `.env.*` 포함 |
| T-05-08 | Elevation of Privilege | mitigate | CLOSED | .github/workflows/deploy.yml:36-38 — google-github-actions/auth@v3 with `workload_identity_provider` + `service_account` (keyless OIDC, 서비스 키 JSON 없음) |
| T-05-09 | Information Disclosure | mitigate | CLOSED | apps/web/instrumentation-client.ts:5 — `tracesSampleRate: 0.1`. api-client에서 STATUS_MESSAGES로 PII 미포함 메시지만 사용. `SENTRY_AUTH_TOKEN`은 .env.example에 placeholder만 있고 CI secret으로 관리 |
| T-05-10 | Spoofing | mitigate | OPEN | deploy.yml에 Cloudflare WAF 배치 또는 Cloud Run invoker 권한 제한 설정 없음. 선언된 mitigate 근거가 IaC/문서에서 확인되지 않음 |
| T-05-11 | Information Disclosure | mitigate | CLOSED | .dockerignore:4-5 — `.env` 및 `.env.*` 포함. 05-04-SUMMARY.md: "프로덕션 환경변수는 GCP Secret Manager → Cloud Run secret mount로만 주입" |
| T-05-05-01 | Tampering | accept | CLOSED | CSS 클래스 변경만, 서버/데이터 접점 없음 |

---

## Accepted Risks Log

| Threat ID | Category | Rationale |
|-----------|----------|-----------|
| T-05-01 | Information Disclosure | MobileTabBar는 하드코딩된 href 링크 4개만 포함. 사용자 식별 정보, 토큰, 세션 데이터 없음. |
| T-05-02 | Spoofing | aria-current="page"는 CSS 활성 탭 표시용. 이 값을 조작해도 인증 결정에 영향 없음. 인증/인가는 서버 미들웨어에서 처리. |
| T-05-03 | Information Disclosure | 스켈레톤 컴포넌트는 Tailwind 클래스로 구성된 정적 placeholder만 렌더링. API 응답 데이터, 사용자 정보 전혀 포함하지 않음. |
| T-05-06 | Denial of Service | window.location.reload()는 사용자 click 이벤트에만 반응. 이벤트 루프 자동 호출 없음. 브라우저 자체 클릭 쓰로틀링 적용됨. |
| T-05-05-01 | Tampering | bottom-[56px] / CSS 클래스 변경은 렌더 트리에만 영향. API 경로, 인증 헤더, DB 쿼리에 전혀 접점 없음. |

---

## Open Threats

| Threat ID | Category | Mitigation Expected | Files Searched | Finding |
|-----------|----------|---------------------|----------------|---------|
| T-05-10 | Spoofing | Cloudflare WAF 배치, Cloud Run invoker 권한 제한 | .github/workflows/deploy.yml | deploy.yml에 `--no-allow-unauthenticated` 플래그, Cloudflare 프록시 설정, Cloud Run invoker IAM 바인딩 중 어느 것도 없음. Cloud Run 서비스가 현재 인터넷에서 직접 접근 가능한 상태. |

**Next:** Cloud Run 서비스 배포 시 `--no-allow-unauthenticated` 플래그를 추가하거나, Cloudflare Workers/Tunnel로 트래픽을 프록시하는 IaC를 작성하고 deploy.yml에 포함한 뒤 SECURITY.md를 재감사하세요.

---

## Unregistered Threat Flags

SUMMARY.md `## Threat Flags` 섹션 없음 — 모든 5개 SUMMARY 파일에 별도 Threat Flags 섹션이 없음. 등록되지 않은 신규 공격 표면 없음.

---

## Notes

**T-05-07 / T-05-11 — 2-stage vs 3-stage Dockerfile:**
계획(PLAN.md)은 3-stage 멀티스테이지(deps → builder → runner)를 명시했으나, 구현된 Dockerfile은 2-stage(builder → runner)입니다. 보안 목적(빌드 도구/소스 분리, .env 미포함)은 충족됩니다. deps stage 생략은 보안 gap이 아니라 빌드 최적화 deviation입니다. T-05-07/T-05-11 CLOSED 판정에 영향 없습니다.

**T-05-05 — error.tsx vs global-error.tsx:**
`apps/web/app/error.tsx`(nested 에러 바운더리)는 `ApiClientError.statusCode`를 `ERR-{statusCode}` 형태로 표시합니다. `apps/web/app/global-error.tsx`(root 레이아웃 에러 바운더리)는 `error.digest`만 표시하고 raw `error.message`를 노출하지 않습니다. 두 파일 모두 계획의 mitigate 요구사항을 충족합니다.
