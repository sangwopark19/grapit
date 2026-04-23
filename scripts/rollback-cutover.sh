#!/usr/bin/env bash
# scripts/rollback-cutover.sh
# Phase 13 Plan 04 — Rollback the heygrabit.com apex Global HTTPS LB cutover.
#
# Note: Wave 3 decision — asia-northeast3 Cloud Run domain-mappings is UNIMPLEMENTED,
# so both api and apex routing live on a Global External HTTPS Load Balancer.
# Rollback therefore targets the LB's URL Map, not a Cloud Run domain mapping.
#
# Usage:
#   1. BEFORE cutover: ./scripts/rollback-cutover.sh capture       # captures rollback.yaml
#   2. AFTER cutover (if needed): ./scripts/rollback-cutover.sh restore
# Note: rollback.yaml is git-ignored (see .gitignore) — do not commit.
set -euo pipefail

URL_MAP="grabit-api-urlmap"
TARGET_PROXY="grabit-api-proxy"
PROJECT_ID="grapit-491806"
ROLLBACK_FILE="rollback.yaml"

case "${1:-}" in
  capture)
    echo "=== Capturing current URL Map state -> $ROLLBACK_FILE ==="
    gcloud compute url-maps describe "$URL_MAP" \
      --project="$PROJECT_ID" \
      --format=yaml > "$ROLLBACK_FILE"
    echo "  Captured URL Map '$URL_MAP'"
    echo "  Also capturing Target HTTPS Proxy SSL cert attachments..."
    gcloud compute target-https-proxies describe "$TARGET_PROXY" \
      --project="$PROJECT_ID" \
      --format='value(sslCertificates)' >> "$ROLLBACK_FILE"
    echo "  Done — rollback.yaml has URL Map yaml + current sslCertificates list appended."
    ;;
  restore)
    echo "=== Restoring URL Map to pre-Wave-4 state (api-only, no host rules) ==="
    [ -f "$ROLLBACK_FILE" ] || { echo "ERROR: $ROLLBACK_FILE not found"; exit 1; }
    echo "  Removing host-based routing (api-matcher + web-matcher)..."
    gcloud compute url-maps remove-path-matcher "$URL_MAP" \
      --project="$PROJECT_ID" \
      --path-matcher-name=web-matcher 2>/dev/null || true
    gcloud compute url-maps remove-path-matcher "$URL_MAP" \
      --project="$PROJECT_ID" \
      --path-matcher-name=api-matcher 2>/dev/null || true
    echo "  Restoring default-service to grabit-api-backend..."
    gcloud compute url-maps set-default-service "$URL_MAP" \
      --project="$PROJECT_ID" \
      --default-service=grabit-api-backend
    echo "  Detaching grabit-web-cert from Target HTTPS Proxy (keep grabit-api-cert only)..."
    gcloud compute target-https-proxies update "$TARGET_PROXY" \
      --project="$PROJECT_ID" \
      --ssl-certificates=grabit-api-cert
    echo ""
    echo "  Verification:"
    curl -sI https://api.heygrabit.com/api/v1/health | head -1 || true
    echo ""
    echo "=== Wave 4 rollback complete (api.heygrabit.com 그대로; apex routing 제거) ==="
    echo "=== Note: grabit-web-neg / grabit-web-backend / grabit-web-cert 리소스는 보존됨 (수동 삭제 필요 시 별도) ==="
    ;;
  *)
    echo "Usage: $0 {capture|restore}"
    echo "  capture: save current URL Map + proxy cert state as rollback.yaml (run BEFORE cutover)"
    echo "  restore: revert URL Map to api-only default-service (run AFTER failed cutover)"
    exit 1
    ;;
esac
