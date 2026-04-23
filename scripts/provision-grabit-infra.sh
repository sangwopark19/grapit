#!/usr/bin/env bash
# scripts/provision-grabit-infra.sh
# Phase 13 Plan 03 (Revision 2) — Grabit blue-green provisioning helper.
#
# Purpose (idempotent, safe to re-run):
#   1. Artifact Registry 'grabit' repo 존재 보장 (없으면 생성)
#   2. D-11: AR IAM 바인딩 사전 검증 가이드 출력 (deploy SA writer + grapit-cloudrun@ reader)
#   3. Sentry 프로젝트 / Secret Manager / GitHub secret 수동 단계 안내
#   4. 새 Cloud Run 서비스 (grabit-api, grabit-web) 상태 확인 (deploy 후)
#   5. D-09: api.heygrabit.com → grabit-api domain-mapping 생성/확인
#
# Usage:
#   ./scripts/provision-grabit-infra.sh <GCP_PROJECT_ID>
#
# Prerequisites:
#   - gcloud CLI 인증 + 올바른 프로젝트 선택
#   - Cloudflare (또는 DNS provider) 에서 api.heygrabit.com CNAME ghs.googlehosted.com 선등록
#   - gh CLI 인증 (수동 단계 안내 출력용)
#
# Exit codes:
#   0 — 모든 체크 성공 또는 인간 수동 단계 대기
#   non-zero — gcloud 호출 실패 (로그 참조)
set -euo pipefail

PROJECT_ID="${1:?Usage: $0 <GCP_PROJECT_ID>}"
REGION="asia-northeast3"
AR_REPO="grabit"
API_DOMAIN="api.heygrabit.com"
API_SERVICE="grabit-api"
WEB_SERVICE="grabit-web"

echo ""
echo "=== [1/5] Artifact Registry '${AR_REPO}' (${REGION}) ==="
if gcloud artifacts repositories describe "$AR_REPO" \
    --location="$REGION" \
    --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "  OK: already exists — skip create"
else
  echo "  Creating new docker repo '${AR_REPO}' in ${REGION}..."
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --project="$PROJECT_ID" \
    --description="Grabit brand rename target repo (Phase 13)"
  echo "  Created."
fi

echo ""
echo "=== [2/5] D-11: AR IAM bindings sanity (informational) ==="
echo "  Run these manually and confirm non-empty output:"
echo ""
echo "    # deploy principal (=\$GCP_SERVICE_ACCOUNT secret, 보통 *-github-deployer@...)"
echo "    DEPLOY_SA_EMAIL=\"<github-actions-deployer>@${PROJECT_ID}.iam.gserviceaccount.com\""
echo "    gcloud projects get-iam-policy ${PROJECT_ID} \\"
echo "      --flatten='bindings[].members' \\"
echo "      --filter=\"bindings.members:serviceAccount:\${DEPLOY_SA_EMAIL} AND bindings.role:roles/artifactregistry.writer\" \\"
echo "      --format='value(bindings.role)'"
echo "    # Expected: roles/artifactregistry.writer (non-empty)"
echo ""
echo "    # grapit-cloudrun@ SA (D-05 per phase 13; name retained)"
echo "    gcloud projects get-iam-policy ${PROJECT_ID} \\"
echo "      --flatten='bindings[].members' \\"
echo "      --filter=\"bindings.members:serviceAccount:grapit-cloudrun@${PROJECT_ID}.iam.gserviceaccount.com AND bindings.role:roles/artifactregistry.reader\" \\"
echo "      --format='value(bindings.role)'"
echo "    # Expected: roles/artifactregistry.reader (non-empty)"
echo ""
echo "  누락 시 (둘 중 하나라도 empty 이면):"
echo "    gcloud projects add-iam-policy-binding ${PROJECT_ID} \\"
echo "      --member=\"serviceAccount:\${DEPLOY_SA_EMAIL}\" \\"
echo "      --role=\"roles/artifactregistry.writer\""
echo "    gcloud projects add-iam-policy-binding ${PROJECT_ID} \\"
echo "      --member=\"serviceAccount:grapit-cloudrun@${PROJECT_ID}.iam.gserviceaccount.com\" \\"
echo "      --role=\"roles/artifactregistry.reader\""

echo ""
echo "=== [3/5] Sentry projects + Secret Manager + GitHub (manual) ==="
echo "  Open: https://sentry.io/organizations/{ORG}/projects/new/"
echo "  Create: grabit-api (Node.js), grabit-web (Next.js); copy DSNs."
echo ""
echo "  Then run (one-liner per step):"
echo "    echo -n '<grabit-api-dsn>' | gcloud secrets versions add sentry-dsn --data-file=- --project=${PROJECT_ID}"
echo "    gh secret set NEXT_PUBLIC_SENTRY_DSN --body '<grabit-web-dsn>'"
echo "    # D-09: API 도메인 SoT = api.heygrabit.com (subdomain, OAuth callback 안정화)"
echo "    gh variable set CLOUD_RUN_API_URL --body 'https://api.heygrabit.com'"
echo "    # DNS: api.heygrabit.com CNAME ghs.googlehosted.com (Cloudflare proxy OFF)"

echo ""
echo "=== [4/5] Smoke — Cloud Run services ==="
for svc in "$API_SERVICE" "$WEB_SERVICE"; do
  if gcloud run services describe "$svc" \
      --region="$REGION" \
      --project="$PROJECT_ID" >/dev/null 2>&1; then
    STATUS=$(gcloud run services describe "$svc" \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --format='value(status.conditions[0].status)' 2>/dev/null || echo "Unknown")
    URL=$(gcloud run services describe "$svc" \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --format='value(status.url)' 2>/dev/null || echo "<unknown>")
    echo "  ${svc}: status=${STATUS} url=${URL}"
  else
    echo "  ${svc}: NOT YET deployed (expected before first deploy.yml run on main)"
  fi
done

echo ""
echo "=== [5/5] D-09: ${API_DOMAIN} domain-mapping ==="
if gcloud run services describe "$API_SERVICE" \
    --region="$REGION" \
    --project="$PROJECT_ID" >/dev/null 2>&1; then
  if gcloud beta run domain-mappings describe \
      --domain="$API_DOMAIN" \
      --region="$REGION" \
      --project="$PROJECT_ID" >/dev/null 2>&1; then
    ROUTE=$(gcloud beta run domain-mappings describe \
      --domain="$API_DOMAIN" \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --format='value(spec.routeName)' 2>/dev/null || echo "<unknown>")
    DM_STATUS=$(gcloud beta run domain-mappings describe \
      --domain="$API_DOMAIN" \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --format='value(status.conditions[0].status)' 2>/dev/null || echo "Unknown")
    echo "  domain-mapping ${API_DOMAIN} already exists, routeName=${ROUTE}, status=${DM_STATUS}"
    if [ "$ROUTE" != "$API_SERVICE" ]; then
      echo "  WARNING: domain-mapping routes to '${ROUTE}', expected '${API_SERVICE}' — investigate"
    fi
  else
    echo "  Creating domain-mapping ${API_DOMAIN} → ${API_SERVICE} ..."
    gcloud beta run domain-mappings create \
      --service="$API_SERVICE" \
      --domain="$API_DOMAIN" \
      --region="$REGION" \
      --project="$PROJECT_ID"
    echo "  Waiting for Ready status (up to 15 min for Google-managed SSL cert)..."
    for i in $(seq 1 60); do
      STATUS=$(gcloud beta run domain-mappings describe \
        --domain="$API_DOMAIN" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format='value(status.conditions[0].status)' 2>/dev/null || echo "Unknown")
      echo "    [${i}/60] status=${STATUS}"
      if [ "$STATUS" = "True" ]; then
        echo "    Ready — ${API_DOMAIN} is live"
        break
      fi
      sleep 15
    done
    echo ""
    echo "  Health check:"
    echo "    curl -sI https://${API_DOMAIN}/api/v1/health | head -1"
    echo "    # Expected: HTTP/2 200 or 503 (Valkey 대기 허용)"
  fi
else
  echo "  ${API_SERVICE} not yet deployed — skip domain-mapping (rerun after first deploy.yml on main)"
fi

echo ""
echo "=== DONE ==="
echo "Next steps:"
echo "  1. Pre-merge: complete Section [2/5] IAM check + [3/5] manual DSN/secret updates"
echo "  2. Merge deploy.yml PR → GitHub Actions Deploy workflow runs"
echo "  3. Post-first-deploy: rerun this script to confirm Sections [4/5] and [5/5]"
echo "  4. D-13: gh variable set CLOUD_RUN_WEB_URL \"<new grabit-web .run.app URL>\""
echo "  5. D-13: gh workflow run deploy.yml  (second deploy forces env refresh)"
echo "  6. D-12: curl admin sentry-test endpoints → verify Sentry event IDs"
echo "     (api:/api/v1/admin/_sentry-test — NestJS unaffected by leading _)"
echo "     (web:/admin/sentry-test         — Next.js excludes leading _ as private folder)"
