---
phase: 05
slug: polish-launch
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-08
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| API 에러 응답 → 클라이언트 표시 | 서버 에러 메시지가 사용자에게 노출되는 경계 | 에러 메시지, 상태 코드 |
| navigator.onLine → UI 상태 | 브라우저 네트워크 상태 감지 | 네트워크 상태 (boolean) |
| Docker 이미지 → 시크릿 | 빌드 시 시크릿이 이미지에 포함되지 않아야 함 | 환경변수, 소스코드 |
| Sentry DSN → 외부 서비스 | 에러 데이터가 Sentry 서버로 전송됨 | 에러 스택, 사용자 컨텍스트 |
| 클라이언트 렌더링 | 모바일/데스크톱 분기는 CSS 미디어쿼리로만 처리 | 없음 (순수 UI) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-05-01 | Information Disclosure | MobileTabBar | accept | 네비게이션 링크만 포함, 민감 데이터 없음 | closed |
| T-05-02 | Spoofing | aria-current | accept | CSS 표시 용도만, 인증/인가 로직 없음 | closed |
| T-05-03 | Information Disclosure | Skeleton variants | accept | 정적 placeholder만 렌더링, 사용자 데이터 미포함 | closed |
| T-05-04 | Information Disclosure | api-client error interceptor | mitigate | `apps/web/lib/api-client.ts:109-125` — STATUS_MESSAGES lookup, server message 필드만 사용, stack/query 무시 | closed |
| T-05-05 | Information Disclosure | error.tsx | mitigate | `apps/web/app/error.tsx:27-30` — ERR-{statusCode} 형태만 노출. `apps/web/app/global-error.tsx:28-30` — error.digest만 표시 | closed |
| T-05-06 | Denial of Service | NetworkBanner reload | accept | window.location.reload()는 사용자 직접 클릭으로만 실행 | closed |
| T-05-07 | Information Disclosure | Docker image | mitigate | `apps/web/Dockerfile` + `apps/api/Dockerfile` 멀티스테이지 빌드. `.dockerignore:4-5` — .env 및 .env.* 포함 | closed |
| T-05-08 | Elevation of Privilege | GitHub Actions secrets | mitigate | `.github/workflows/deploy.yml:36-38` — google-github-actions/auth@v3 OIDC keyless 인증, 최소 권한 | closed |
| T-05-09 | Information Disclosure | Sentry error data | mitigate | `apps/web/instrumentation-client.ts:5` — tracesSampleRate: 0.1. STATUS_MESSAGES로 PII 미포함. SENTRY_AUTH_TOKEN은 CI secret | closed |
| T-05-10 | Spoofing | Cloud Run public access | accept | 공개 웹서비스로 --allow-unauthenticated 필수. 프로덕션 배포 시 Cloudflare DNS 프록시로 WAF 적용 예정 (아래 체크리스트 참조) | closed |
| T-05-11 | Information Disclosure | .env in Docker | mitigate | `.dockerignore:4-5` — .env, .env.* 포함. 프로덕션 환경변수는 GCP Secret Manager → Cloud Run secret mount | closed |
| T-05-05-01 | Tampering | UI layout | accept | CSS 클래스 변경만, 서버/데이터 접점 없음 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-05-01 | MobileTabBar는 하드코딩된 네비게이션 링크만 포함하여 정보 노출 위험 없음 | Sangwoo Park | 2026-04-08 |
| AR-02 | T-05-02 | aria-current는 CSS 표시 용도. 인증/인가와 무관 | Sangwoo Park | 2026-04-08 |
| AR-03 | T-05-03 | 스켈레톤 UI는 정적 placeholder만 렌더링하여 사용자 데이터 미포함 | Sangwoo Park | 2026-04-08 |
| AR-04 | T-05-06 | NetworkBanner reload는 사용자 직접 클릭 필요. 자동 재시도 없음 | Sangwoo Park | 2026-04-08 |
| AR-05 | T-05-10 | 공개 웹서비스이므로 Cloud Run 공개 접근 필수. 프로덕션 배포 시 Cloudflare WAF로 보호 | Sangwoo Park | 2026-04-08 |
| AR-06 | T-05-05-01 | 순수 CSS 레이아웃 변경만 포함, 서버/데이터 접점 없음 | Sangwoo Park | 2026-04-08 |

### T-05-10 프로덕션 배포 체크리스트

Cloud Run 서비스를 Cloudflare WAF 뒤에 배치하기 위한 단계:

1. **Cloudflare에 도메인 등록**
   - Cloudflare Dashboard → Add Site → 도메인 입력
   - DNS 네임서버를 Cloudflare로 변경

2. **DNS 레코드 설정**
   - Type: `CNAME`
   - Name: `@` (또는 `www`)
   - Target: Cloud Run 서비스 URL (예: `web-xxxxx-du.a.run.app`)
   - Proxy status: **Proxied** (주황색 구름 ON) ← 이게 WAF 활성화 핵심

3. **Cloud Run 커스텀 도메인 매핑**
   ```bash
   gcloud run domain-mappings create --service=web --domain=grapit.kr --region=asia-northeast3
   ```

4. **Cloudflare WAF 규칙 설정** (선택)
   - Security → WAF → Managed Rules 활성화
   - Rate Limiting: 분당 요청 수 제한 설정

5. **검증**
   - `curl -I https://grapit.kr` → `server: cloudflare` 헤더 확인
   - Cloud Run 기본 URL(*.run.app)은 사용자에게 비공개

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-08 | 12 | 12 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-08
